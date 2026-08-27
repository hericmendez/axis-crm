import { describe, expect, it, vi } from 'vitest';
import { createOrchestrator, type OrchestratorDeps } from '../../src/ai/orchestrator.js';
import type { LLMProvider, StructuredOutput } from '../../src/types/ai.js';
import type { MensagemConversa } from '../../src/types/conversa.js';

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

function makeDeps(overrides: Partial<OrchestratorDeps> = {}): OrchestratorDeps {
	return {
		llmProvider: makeLLM({ mode: 'CHAT', confidence: 0.9, response: 'Olá!' }),
		getRecentMessages: vi.fn().mockResolvedValue([]),
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

	it('envia contexto de mensagens anteriores ao LLM', async () => {
		const messages = makeMessages('Olá', 'Como posso ajudar?', 'Quero criar um lead');
		const deps = makeDeps({
			getRecentMessages: vi.fn().mockResolvedValue(messages),
		});
		const orchestrator = createOrchestrator(deps);
		await orchestrator.processMessage('conv-1', 'Com telefone 16999999999');

		const llmCall = (deps.llmProvider.complete as ReturnType<typeof vi.fn>).mock.calls[0];
		const chatMessages = llmCall[0].messages;
		expect(chatMessages[0].role).toBe('user');
		expect(chatMessages[0].content).toBe('Olá');
		expect(chatMessages[1].role).toBe('assistant');
		expect(chatMessages[1].content).toBe('Como posso ajudar?');
		expect(chatMessages[2].role).toBe('user');
		expect(chatMessages[2].content).toBe('Quero criar um lead');
		expect(chatMessages[3].role).toBe('user');
		expect(chatMessages[3].content).toBe('Com telefone 16999999999');
	});

	it('limita contexto a 10 mensagens', async () => {
		const messages = makeMessages(
			'm1', 'm2', 'm3', 'm4', 'm5',
			'm6', 'm7', 'm8', 'm9', 'm10',
			'm11', 'm12',
		);
		const deps = makeDeps({
			getRecentMessages: vi.fn().mockResolvedValue(messages),
		});
		const orchestrator = createOrchestrator(deps);
		await orchestrator.processMessage('conv-1', 'última');

		expect(deps.getRecentMessages).toHaveBeenCalledWith('conv-1', 10);
	});

	it('retorna INFRASTRUCTURE_ERROR quando getRecentMessages falha', async () => {
		const deps = makeDeps({
			getRecentMessages: vi.fn().mockRejectedValue(new Error('MongoDB down')),
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
});
