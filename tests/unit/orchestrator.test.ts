import { describe, expect, it, vi } from 'vitest';
import { createOrchestrator, type OrchestratorDeps } from '../../src/ai/orchestrator.js';
import type { LLMProvider, StructuredOutput } from '../../src/types/ai.js';
import type { ConversationContext, MensagemConversa } from '../../src/types/conversa.js';
import type { InternalTool } from '../../src/ai/tools/internal-tool.js';
import type { OrchestratorResult } from '../../src/ai/errors.js';

function makeTool(result: OrchestratorResult): InternalTool {
	return { execute: vi.fn().mockResolvedValue(result) };
}

function makeLLM(output: StructuredOutput): LLMProvider {
	return { complete: vi.fn().mockResolvedValue(output) };
}

function makeFailingLLM(error: Error): LLMProvider {
	return { complete: vi.fn().mockRejectedValue(error) };
}

function makeMessages(...contents: string[]): MensagemConversa[] {
	return contents.map((c, i) => ({
		id: `msg-${i}`,
		papel: i % 2 === 0 ? 'usuario' : 'axis',
		conteudo: c,
		criadoEm: new Date(),
	}));
}

function makeContext(
	recentMessages: MensagemConversa[] = [],
	summary?: string,
): ConversationContext {
	return { summary, recentMessages };
}

function makeDeps(overrides: Partial<OrchestratorDeps> = {}): OrchestratorDeps {
	return {
		llmProvider: makeLLM({ mode: 'CHAT', confidence: 0.9, response: 'Olá!' }),
		getConversationContext: vi.fn().mockResolvedValue(makeContext()),
		intentRouterDeps: {
			leadService: {
				create: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'João', telefone: '16999999999' }),
				update: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'João', telefone: '16999999999' }),
				getById: vi.fn().mockResolvedValue(null),
			},
			eventoService: {
				create: vi.fn().mockResolvedValue({ id: 'evento-1' }),
			},
			metricasService: {
				agenda: vi.fn().mockResolvedValue([]),
			},
			leadRepository: {
				findById: vi.fn().mockResolvedValue(null),
				findByTelefone: vi.fn().mockResolvedValue(null),
				findByName: vi.fn().mockResolvedValue([]),
			},
			tools: {
				createLead: makeTool({ type: 'SUCCESS', message: 'Lead criado: João (16999999999).' }),
				updateLead: makeTool({ type: 'SUCCESS', message: 'Lead atualizado: João.' }),
				registerEvent: makeTool({ type: 'SUCCESS', message: 'Evento registrado: VENDA para João.' }),
				consultAgenda: makeTool({ type: 'SUCCESS', message: 'Agendamentos:\n- João (01/09/2026)' }),
			},
		},
		...overrides,
	};
}

describe('orchestrator', () => {
	it('processa mensagem CHAT e retorna response do LLM', async () => {
		const deps = makeDeps();
		const orchestrator = createOrchestrator(deps);
		const result = await orchestrator.processMessage('conv-1', 'Olá!');
		expect(result.type).toBe('SUCCESS');
		expect(result.message).toBe('Olá!');
	});

	it('processa mensagem ACTION e roteia para intent', async () => {
		const deps = makeDeps({
			llmProvider: makeLLM({
				mode: 'ACTION',
				intent: 'CRIAR_LEAD',
				confidence: 0.95,
				parameters: { nome: 'João', telefone: '16999999999' },
			}),
		});
		const orchestrator = createOrchestrator(deps);
		const result = await orchestrator.processMessage('conv-1', 'Cria um lead João');
		expect(result.type).toBe('SUCCESS');
		expect(result.message).toContain('Lead criado');
	});

	it('retorna LLM_ERROR quando LLM falha', async () => {
		const deps = makeDeps({
			llmProvider: makeFailingLLM(new Error('ECONNREFUSED')),
		});
		const orchestrator = createOrchestrator(deps);
		const result = await orchestrator.processMessage('conv-1', 'Olá');
		expect(result.type).toBe('LLM_ERROR');
	});

	it('retorna LLM_ERROR quando LLM retorna JSON inválido', async () => {
		const deps = makeDeps({
			llmProvider: { complete: vi.fn().mockResolvedValue('not a valid output' as never) },
		});
		const orchestrator = createOrchestrator(deps);
		const result = await orchestrator.processMessage('conv-1', 'Olá');
		expect(result.type).toBe('LLM_ERROR');
	});

	it('envia contexto de mensagens anteriores ao LLM sem duplicar mensagem atual', async () => {
		const contextMessages = makeMessages('Olá', 'Como posso ajudar?', 'Quero criar um lead');
		const deps = makeDeps({
			getConversationContext: vi.fn().mockResolvedValue(makeContext(contextMessages)),
		});
		const orchestrator = createOrchestrator(deps);
		await orchestrator.processMessage('conv-1', 'Quero criar um lead');

		const llmCall = (deps.llmProvider.complete as ReturnType<typeof vi.fn>).mock.calls[0];
		const chatMessages = llmCall[0].messages;
		expect(chatMessages[0].role).toBe('user');
		expect(chatMessages[0].content).toBe('Olá');
		expect(chatMessages[1].role).toBe('assistant');
		expect(chatMessages[1].content).toBe('Como posso ajudar?');
		expect(chatMessages[2].role).toBe('user');
		expect(chatMessages[2].content).toBe('Quero criar um lead');
		expect(chatMessages).toHaveLength(3);
	});

	it('inclui summary como system message quando disponível', async () => {
		const contextMessages = makeMessages('Olá', 'Tudo bem?', 'Quero criar um lead');
		const summary = 'Usuário mencionou interesse em criar lead.';
		const deps = makeDeps({
			getConversationContext: vi.fn().mockResolvedValue(makeContext(contextMessages, summary)),
		});
		const orchestrator = createOrchestrator(deps);
		await orchestrator.processMessage('conv-1', 'Quero criar um lead');

		const llmCall = (deps.llmProvider.complete as ReturnType<typeof vi.fn>).mock.calls[0];
		const chatMessages = llmCall[0].messages;
		expect(chatMessages[0].role).toBe('system');
		expect(chatMessages[0].content).toContain(summary);
		expect(chatMessages[1].role).toBe('user');
		expect(chatMessages[1].content).toBe('Olá');
		expect(chatMessages[2].role).toBe('assistant');
		expect(chatMessages[2].content).toBe('Tudo bem?');
		expect(chatMessages[3].role).toBe('user');
		expect(chatMessages[3].content).toBe('Quero criar um lead');
		expect(chatMessages).toHaveLength(4);
	});

	it('retorna INFRASTRUCTURE_ERROR quando getConversationContext falha', async () => {
		const deps = makeDeps({
			getConversationContext: vi.fn().mockRejectedValue(new Error('MongoDB down')),
		});
		const orchestrator = createOrchestrator(deps);
		const result = await orchestrator.processMessage('conv-1', 'Olá');
		expect(result.type).toBe('INFRASTRUCTURE_ERROR');
	});

	it('retorna resultado do intent-router para MISSING_PARAMETERS', async () => {
		const deps = makeDeps({
			llmProvider: makeLLM({
				mode: 'ACTION',
				intent: 'CRIAR_LEAD',
				confidence: 0.9,
				parameters: { nome: 'João' },
			}),
		});
		const orchestrator = createOrchestrator(deps);
		const result = await orchestrator.processMessage('conv-1', 'Cria um lead João');
		expect(result.type).toBe('MISSING_PARAMETERS');
	});

	it('não duplica mensagem quando recentMessages contém apenas a mensagem atual', async () => {
		const currentMessage = makeMessages('Olá');
		const deps = makeDeps({
			getConversationContext: vi.fn().mockResolvedValue(makeContext(currentMessage)),
		});
		const orchestrator = createOrchestrator(deps);
		await orchestrator.processMessage('conv-1', 'Olá');

		const llmCall = (deps.llmProvider.complete as ReturnType<typeof vi.fn>).mock.calls[0];
		const chatMessages = llmCall[0].messages;
		expect(chatMessages).toHaveLength(1);
		expect(chatMessages[0].role).toBe('user');
		expect(chatMessages[0].content).toBe('Olá');
	});

	it('contexto correto com summary e 2 mensagens anteriores', async () => {
		const contextMessages = makeMessages('Oi', 'Olá', 'Quero criar lead');
		const summary = 'Conversa inicial.';
		const deps = makeDeps({
			getConversationContext: vi.fn().mockResolvedValue(makeContext(contextMessages, summary)),
		});
		const orchestrator = createOrchestrator(deps);
		await orchestrator.processMessage('conv-1', 'Quero criar lead');

		const llmCall = (deps.llmProvider.complete as ReturnType<typeof vi.fn>).mock.calls[0];
		const chatMessages = llmCall[0].messages;
		expect(chatMessages).toHaveLength(4);
		expect(chatMessages[0]).toEqual({ role: 'system', content: expect.stringContaining(summary) });
		expect(chatMessages[1]).toEqual({ role: 'user', content: 'Oi' });
		expect(chatMessages[2]).toEqual({ role: 'assistant', content: 'Olá' });
		expect(chatMessages[3]).toEqual({ role: 'user', content: 'Quero criar lead' });
	});
});
