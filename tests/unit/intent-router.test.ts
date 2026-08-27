import { describe, expect, it, vi } from 'vitest';
import { routeIntent, type IntentRouterDeps } from '../../src/ai/intent-router.js';
import type { InternalTool } from '../../src/ai/tools/internal-tool.js';
import type { OrchestratorResult } from '../../src/ai/errors.js';

function makeTool(result: OrchestratorResult): InternalTool {
	return { execute: vi.fn().mockResolvedValue(result) };
}

function makeDeps(overrides: Partial<IntentRouterDeps> = {}): IntentRouterDeps {
	return {
		leadService: {
			create: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'João', telefone: '16999999999' }),
			update: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'João', telefone: '16999999999' }),
			getById: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'João', telefone: '16999999999' }),
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
		...overrides,
	};
}

describe('intent-router', () => {
	describe('CONVERSAR', () => {
		it('retorna response do LLM para CHAT mode', async () => {
			const deps = makeDeps();
			const result = await routeIntent(
				{ mode: 'CHAT', confidence: 0.9, response: 'Olá! Como posso ajudar?' },
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(result.message).toBe('Olá! Como posso ajudar?');
		});
	});

	describe('CRIAR_LEAD', () => {
		it('cria lead via tool com todos os parâmetros', async () => {
			const deps = makeDeps();
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'CRIAR_LEAD',
					confidence: 0.95,
					parameters: { nome: 'João', telefone: '16999999999' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(result.message).toContain('Lead criado');
			expect(deps.tools.createLead.execute).toHaveBeenCalledWith({
				nome: 'João',
				telefone: '16999999999',
				contatoOrigem: 'whatsapp',
			});
		});

		it('retorna MISSING_PARAMETERS quando telefone ausente', async () => {
			const deps = makeDeps();
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'CRIAR_LEAD',
					confidence: 0.9,
					parameters: { nome: 'João' },
				},
				deps,
			);
			expect(result.type).toBe('MISSING_PARAMETERS');
			if (result.type === 'MISSING_PARAMETERS') {
				expect(result.missing).toContain('telefone');
			}
		});

		it('retorna MISSING_PARAMETERS quando nome ausente', async () => {
			const deps = makeDeps();
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'CRIAR_LEAD',
					confidence: 0.9,
					parameters: { telefone: '16999999999' },
				},
				deps,
			);
			expect(result.type).toBe('MISSING_PARAMETERS');
			if (result.type === 'MISSING_PARAMETERS') {
				expect(result.missing).toContain('nome');
			}
		});

		it('usa contatoOrigem "whatsapp" automaticamente', async () => {
			const deps = makeDeps();
			await routeIntent(
				{
					mode: 'ACTION',
					intent: 'CRIAR_LEAD',
					confidence: 0.9,
					parameters: { nome: 'João', telefone: '16999999999' },
				},
				deps,
			);
			expect(deps.tools.createLead.execute).toHaveBeenCalledWith(
				expect.objectContaining({ contatoOrigem: 'whatsapp' }),
			);
		});
	});

	describe('ATUALIZAR_LEAD', () => {
		it('atualiza lead via tool por leadId', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findById: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'João', telefone: '16999999999' }),
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'ATUALIZAR_LEAD',
					confidence: 0.9,
					parameters: { leadId: 'lead-1', status: 'VENDIDO' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.updateLead.execute).toHaveBeenCalledWith({
				leadId: 'lead-1',
				patch: expect.objectContaining({ status: 'VENDIDO' }),
			});
		});

		it('resolve lead por nome quando há único resultado', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'João', telefone: '16999999999' }]),
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'ATUALIZAR_LEAD',
					confidence: 0.9,
					parameters: { leadRef: 'João', status: 'VENDIDO' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.updateLead.execute).toHaveBeenCalledWith(
				expect.objectContaining({ leadId: 'lead-1' }),
			);
		});

		it('retorna ENTITY_NOT_FOUND quando lead não existe', async () => {
			const deps = makeDeps();
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'ATUALIZAR_LEAD',
					confidence: 0.9,
					parameters: { leadRef: 'Inexistente' },
				},
				deps,
			);
			expect(result.type).toBe('ENTITY_NOT_FOUND');
		});

		it('retorna AMBIGUOUS_ENTITY quando múltiplos leads', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([
						{ id: 'lead-1', nome: 'João Silva', telefone: '11111111111' },
						{ id: 'lead-2', nome: 'João Santos', telefone: '22222222222' },
						{ id: 'lead-3', nome: 'João Pereira', telefone: '33333333333' },
					]),
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'ATUALIZAR_LEAD',
					confidence: 0.9,
					parameters: { leadRef: 'João' },
				},
				deps,
			);
			expect(result.type).toBe('AMBIGUOUS_ENTITY');
			if (result.type === 'AMBIGUOUS_ENTITY') {
				expect(result.candidates).toHaveLength(3);
			}
		});

		it('resolve lead por telefone', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByTelefone: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'João', telefone: '16999999999' }),
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'ATUALIZAR_LEAD',
					confidence: 0.9,
					parameters: { telefone: '16999999999', status: 'VENDIDO' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
		});
	});

	describe('CONSULTAR_AGENDA', () => {
		it('retorna agendamentos via tool quando há itens', async () => {
			const deps = makeDeps();
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'CONSULTAR_AGENDA',
					confidence: 0.9,
					parameters: {},
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(result.message).toContain('Agendamentos');
			expect(deps.tools.consultAgenda.execute).toHaveBeenCalledWith(
				expect.objectContaining({ de: expect.any(Date), ate: expect.any(Date) }),
			);
		});

		it('retorna mensagem quando nenhum agendamento', async () => {
			const tool = makeTool({ type: 'SUCCESS', message: 'Nenhum agendamento encontrado para este período.' });
			const deps = makeDeps({ tools: { ...makeDeps().tools, consultAgenda: tool } });
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'CONSULTAR_AGENDA',
					confidence: 0.9,
					parameters: {},
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(result.message).toContain('Nenhum agendamento');
		});

		it('usa default de 7 dias quando sem período', async () => {
			const deps = makeDeps();
			await routeIntent(
				{
					mode: 'ACTION',
					intent: 'CONSULTAR_AGENDA',
					confidence: 0.9,
					parameters: {},
				},
				deps,
			);
			expect(deps.tools.consultAgenda.execute).toHaveBeenCalled();
			const call = (deps.tools.consultAgenda.execute as ReturnType<typeof vi.fn>).mock.calls[0];
			const input = call[0] as { de: Date; ate: Date };
			const diffDays = (input.ate.getTime() - input.de.getTime()) / (1000 * 60 * 60 * 24);
			expect(diffDays).toBeCloseTo(7, 0);
		});
	});

	describe('REGISTRAR_EVENTO', () => {
		it('registra evento via tool com leadId', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findById: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'João', telefone: '16999999999' }),
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.9,
					parameters: { leadId: 'lead-1', tipo: 'VENDA' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.registerEvent.execute).toHaveBeenCalledWith(
				expect.objectContaining({ leadId: 'lead-1', tipo: 'VENDA', leadNome: 'João' }),
			);
		});

		it('retorna ENTITY_NOT_FOUND quando lead não existe', async () => {
			const deps = makeDeps();
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.9,
					parameters: { leadRef: 'Inexistente', tipo: 'VENDA' },
				},
				deps,
			);
			expect(result.type).toBe('ENTITY_NOT_FOUND');
		});

		it('retorna AMBIGUOUS_ENTITY quando múltiplos leads', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([
						{ id: 'lead-1', nome: 'João Silva', telefone: '11111111111' },
						{ id: 'lead-2', nome: 'João Santos', telefone: '22222222222' },
					]),
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.9,
					parameters: { leadRef: 'João', tipo: 'VENDA' },
				},
				deps,
			);
			expect(result.type).toBe('AMBIGUOUS_ENTITY');
		});
	});

	describe('erros', () => {
		it('retorna SERVICE_ERROR quando tool lança exceção', async () => {
			const deps = makeDeps({
				tools: {
					...makeDeps().tools,
					createLead: { execute: vi.fn().mockRejectedValue(new Error('Duplicate key')) },
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'CRIAR_LEAD',
					confidence: 0.9,
					parameters: { nome: 'João', telefone: '16999999999' },
				},
				deps,
			);
			expect(result.type).toBe('SERVICE_ERROR');
		});

		it('retorna INVALID_INTENT para intent desconhecida', async () => {
			const deps = makeDeps();
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'DELETAR_TUDO' as never,
					confidence: 0.9,
					parameters: {},
				},
				deps,
			);
			expect(result.type).toBe('INVALID_INTENT');
		});
	});
});
