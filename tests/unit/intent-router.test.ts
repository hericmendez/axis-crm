import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routeIntent, type IntentRouterDeps } from '../../src/ai/intent-router.js';
import type { InternalTool } from '../../src/ai/tools/internal-tool.js';
import type { OrchestratorResult } from '../../src/ai/errors.js';

const REFERENCE_NOW = new Date(2026, 7, 27, 10, 0, 0);

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(REFERENCE_NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

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
			resolveTarget: vi.fn().mockResolvedValue({
				status: 'FOUND',
				evento: { id: 'evento-1', leadId: 'lead-1', tipo: 'AGENDAMENTO', data: new Date('2026-09-01T10:00:00-03:00'), createdAt: new Date() },
			}),
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

		it('resolve lead por nome quando há único resultado', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([{ id: 'lead-103', nome: 'Pedro Lucas', telefone: '31999876543' }]),
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO', data: '2026-08-28T14:00:00' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.registerEvent.execute).toHaveBeenCalledWith(
				expect.objectContaining({ leadId: 'lead-103', tipo: 'AGENDAMENTO', leadNome: 'Pedro Lucas' }),
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

		it('tipo já informado com data não retorna MISSING_PARAMETERS', async () => {
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
					parameters: { leadId: 'lead-1', tipo: 'AGENDAMENTO', data: '2026-08-28T14:00:00' },
				},
				deps,
			);
			expect(result.type).not.toBe('MISSING_PARAMETERS');
		});

		it('AGENDAMENTO sem data retorna MISSING_PARAMETERS mesmo com tipo e lead', async () => {
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
					parameters: { leadId: 'lead-1', tipo: 'AGENDAMENTO' },
				},
				deps,
			);
			expect(result.type).toBe('MISSING_PARAMETERS');
		});

		it('tipo CALL mapeado como referência a AGENDAMENTO pelo LLM', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'Pedro Lucas', telefone: '31999876543' }]),
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO', data: '2026-08-28T14:00:00' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.registerEvent.execute).toHaveBeenCalledWith(
				expect.objectContaining({ tipo: 'AGENDAMENTO' }),
			);
		});
	});

	describe('entity resolution', () => {
		it('resolve por leadId', async () => {
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
		});

		it('resolve por telefone', async () => {
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

		it('resolve por leadRef (nome)', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'Pedro Lucas', telefone: '31999876543' }]),
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'ATUALIZAR_LEAD',
					confidence: 0.9,
					parameters: { leadRef: 'Pedro Lucas', status: 'VENDIDO' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
		});

		it('NOT_FOUND quando nome não existe', async () => {
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

		it('AMBIGUOUS quando múltiplos nomes', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([
						{ id: 'lead-1', nome: 'Pedro Lucas', telefone: '11111111111' },
						{ id: 'lead-2', nome: 'Pedro Lucas', telefone: '22222222222' },
					]),
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.9,
					parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' },
				},
				deps,
			);
			expect(result.type).toBe('AMBIGUOUS_ENTITY');
			if (result.type === 'AMBIGUOUS_ENTITY') {
				expect(result.candidates).toHaveLength(2);
			}
		});

		it('NOT_FOUND quando leadId não existe', async () => {
			const deps = makeDeps();
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'ATUALIZAR_LEAD',
					confidence: 0.9,
					parameters: { leadId: 'nonexistent', status: 'VENDIDO' },
				},
				deps,
			);
			expect(result.type).toBe('ENTITY_NOT_FOUND');
		});
	});

	describe('MISSING_PARAMETERS', () => {
		it('REGISTRAR_EVENTO sem tipo retorna MISSING_PARAMETERS', async () => {
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
					parameters: { leadId: 'lead-1' },
				},
				deps,
			);
			expect(result.type).toBe('MISSING_PARAMETERS');
			if (result.type === 'MISSING_PARAMETERS') {
				expect(result.missing).toContain('tipo');
			}
		});

		it('REGISTRAR_EVENTO sem referência ao lead retorna MISSING_PARAMETERS', async () => {
			const deps = makeDeps();
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.9,
					parameters: { tipo: 'VENDA' },
				},
				deps,
			);
			expect(result.type).toBe('MISSING_PARAMETERS');
			if (result.type === 'MISSING_PARAMETERS') {
				expect(result.missing).toContain('leadId, telefone ou leadRef');
			}
		});

		it('REGISTRAR_EVENTO com tipo, leadRef e data não retorna MISSING_PARAMETERS', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'João', telefone: '16999999999' }]),
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.9,
					parameters: { leadRef: 'João', tipo: 'AGENDAMENTO', data: '2026-08-28T14:00:00' },
				},
				deps,
			);
			expect(result.type).not.toBe('MISSING_PARAMETERS');
		});
	});

	describe('CANCELAR / REAGENDAR via REGISTRAR_EVENTO (PASSO 5.4)', () => {
		const lead = { id: 'lead-1', nome: 'João', telefone: '16999999999' };
		const eventoAtivo = {
			id: 'evento-1',
			leadId: 'lead-1',
			tipo: 'AGENDAMENTO' as const,
			data: new Date('2026-09-05T10:00:00-03:00'),
			createdAt: new Date('2026-08-20T10:00:00-03:00'),
		};

		function depsComLeadEAlvo(alvo: unknown) {
			return makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findById: vi.fn().mockResolvedValue(lead),
				},
				eventoService: {
					create: vi.fn().mockResolvedValue({ id: 'evento-novo' }),
					resolveTarget: vi.fn().mockResolvedValue(alvo),
				},
			});
		}

		it('DESISTENCIA com único ativo → SUCCESS e executa tool', async () => {
			const deps = depsComLeadEAlvo({ status: 'FOUND', evento: eventoAtivo });
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadId: 'lead-1', tipo: 'DESISTENCIA' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			if (result.type === 'SUCCESS') {
				expect(result.leadId).toBe('lead-1');
			}
			expect(deps.tools.registerEvent.execute).toHaveBeenCalledWith(
				expect.objectContaining({ leadId: 'lead-1', tipo: 'DESISTENCIA' }),
			);
		});

		it('DESISTENCIA sem ativo → ENTITY_NOT_FOUND e NÃO executa tool', async () => {
			const deps = depsComLeadEAlvo({ status: 'NOT_FOUND' });
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadId: 'lead-1', tipo: 'DESISTENCIA' },
				},
				deps,
			);
			expect(result.type).toBe('ENTITY_NOT_FOUND');
			expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
		});

		it('DESISTENCIA com múltiplos ativos → AMBIGUOUS_ENTITY e NÃO executa tool', async () => {
			const deps = depsComLeadEAlvo({
				status: 'AMBIGUOUS',
				candidates: [eventoAtivo, { ...eventoAtivo, id: 'evento-2' }],
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.9,
					parameters: { leadId: 'lead-1', tipo: 'DESISTENCIA' },
				},
				deps,
			);
			expect(result.type).toBe('AMBIGUOUS_ENTITY');
			if (result.type === 'AMBIGUOUS_ENTITY') {
				expect(result.candidates).toHaveLength(2);
			}
			expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
		});

		it('repetir cancelamento (ALREADY_RESOLVED) → informa sem mutação', async () => {
			const deps = depsComLeadEAlvo({ status: 'ALREADY_RESOLVED', evento: eventoAtivo });
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadId: 'lead-1', tipo: 'DESISTENCIA' },
				},
				deps,
			);
			expect(result.type).toBe('ENTITY_NOT_FOUND');
			if (result.type === 'ENTITY_NOT_FOUND') {
				expect(result.message).toContain('já foi cancelado');
			}
			expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
		});

		it('DESISTENCIA com data repassa dataAlvo ao resolveTarget', async () => {
			const deps = depsComLeadEAlvo({ status: 'FOUND', evento: eventoAtivo });
			await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadId: 'lead-1', tipo: 'DESISTENCIA', data: '2026-09-05T10:00:00' },
				},
				deps,
			);
			expect(deps.eventoService.resolveTarget).toHaveBeenCalledWith(
				undefined,
				'lead-1',
				expect.objectContaining({ dataAlvo: expect.any(Date) }),
			);
		});

		it('REAGENDAMENTO com único ativo e nova data → SUCCESS com data nova', async () => {
			const deps = depsComLeadEAlvo({ status: 'FOUND', evento: eventoAtivo });
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadId: 'lead-1', tipo: 'REAGENDAMENTO', data: '2026-09-12T14:00:00' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.registerEvent.execute).toHaveBeenCalledWith(
				expect.objectContaining({ tipo: 'REAGENDAMENTO', data: new Date('2026-09-12T14:00:00') }),
			);
		});

		it('REAGENDAMENTO NÃO usa a nova data como filtro do alvo', async () => {
			const deps = depsComLeadEAlvo({ status: 'FOUND', evento: eventoAtivo });
			await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadId: 'lead-1', tipo: 'REAGENDAMENTO', data: '2026-09-12T14:00:00' },
				},
				deps,
			);
			expect(deps.eventoService.resolveTarget).toHaveBeenCalledWith(undefined, 'lead-1', {});
		});

		it('REAGENDAMENTO com múltiplos ativos → AMBIGUOUS_ENTITY', async () => {
			const deps = depsComLeadEAlvo({
				status: 'AMBIGUOUS',
				candidates: [eventoAtivo, { ...eventoAtivo, id: 'evento-2' }],
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.9,
					parameters: { leadId: 'lead-1', tipo: 'REAGENDAMENTO', data: '2026-09-12T14:00:00' },
				},
				deps,
			);
			expect(result.type).toBe('AMBIGUOUS_ENTITY');
			expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
		});

		it('eventoId repassado ao resolveTarget', async () => {
			const deps = depsComLeadEAlvo({ status: 'FOUND', evento: eventoAtivo });
			await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadId: 'lead-1', tipo: 'DESISTENCIA', eventoId: 'evento-1' },
				},
				deps,
			);
			expect(deps.eventoService.resolveTarget).toHaveBeenCalledWith(
				undefined,
				'lead-1',
				expect.objectContaining({ eventoId: 'evento-1' }),
			);
		});

		it('VENDA não consulta resolveTarget', async () => {
			const deps = depsComLeadEAlvo({ status: 'FOUND', evento: eventoAtivo });
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
			expect(deps.eventoService.resolveTarget).not.toHaveBeenCalled();
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

	describe('leadId em SUCCESS (para vinculação conversa→lead)', () => {
		it('CRIAR_LEAD inclui leadId no resultado', async () => {
			const deps = makeDeps({
				tools: {
					...makeDeps().tools,
					createLead: makeTool({ type: 'SUCCESS', message: 'ok', data: { id: 'lead-novo' }, leadId: 'lead-novo' }),
				},
			});
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
			if (result.type === 'SUCCESS') {
				expect(result.leadId).toBe('lead-novo');
			}
		});

		it('ATUALIZAR_LEAD inclui leadId do lead resolvido', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findById: vi.fn().mockResolvedValue({ id: 'lead-42', nome: 'Maria', telefone: '11987654321' }),
				},
				tools: {
					...makeDeps().tools,
					updateLead: makeTool({ type: 'SUCCESS', message: 'ok' }),
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'ATUALIZAR_LEAD',
					confidence: 0.9,
					parameters: { leadId: 'lead-42', status: 'VENDIDO' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			if (result.type === 'SUCCESS') {
				expect(result.leadId).toBe('lead-42');
			}
		});

		it('REGISTRAR_EVENTO inclui leadId do lead resolvido', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findById: vi.fn().mockResolvedValue({ id: 'lead-99', nome: 'Ana', telefone: '11999887766' }),
				},
				tools: {
					...makeDeps().tools,
					registerEvent: makeTool({ type: 'SUCCESS', message: 'ok' }),
				},
			});
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.9,
					parameters: { leadId: 'lead-99', tipo: 'VENDA' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			if (result.type === 'SUCCESS') {
				expect(result.leadId).toBe('lead-99');
			}
		});

		it('CONSULTAR_AGENDA não inclui leadId', async () => {
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
			if (result.type === 'SUCCESS') {
				expect(result.leadId).toBeUndefined();
			}
		});

		it('CONVERSAR não inclui leadId', async () => {
			const deps = makeDeps();
			const result = await routeIntent(
				{ mode: 'CHAT', confidence: 0.9, response: 'Olá!' },
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			if (result.type === 'SUCCESS') {
				expect(result.leadId).toBeUndefined();
			}
		});
	});
});
