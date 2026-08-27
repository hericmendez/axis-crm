import { describe, expect, it, vi } from 'vitest';
import { routeIntent, type IntentRouterDeps } from '../../src/ai/intent-router.js';

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
		it('cria lead com todos os parâmetros', async () => {
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
			expect(deps.leadService.create).toHaveBeenCalledWith({
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
			expect(deps.leadService.create).toHaveBeenCalledWith(
				expect.objectContaining({ contatoOrigem: 'whatsapp' }),
			);
		});
	});

	describe('ATUALIZAR_LEAD', () => {
		it('atualiza lead por leadId', async () => {
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
			expect(deps.leadService.update).toHaveBeenCalledWith('lead-1', expect.objectContaining({ status: 'VENDIDO' }));
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
			expect(deps.leadService.update).toHaveBeenCalledWith('lead-1', expect.any(Object));
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
		it('retorna agendamentos quando há itens', async () => {
			const deps = makeDeps({
				metricasService: {
					agenda: vi.fn().mockResolvedValue([
						{ nome: 'João', dataAgendamento: new Date('2026-09-01') },
						{ nome: 'Maria', dataAgendamento: new Date('2026-09-02') },
					]),
				},
			});
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
		});

		it('retorna mensagem quando nenhum agendamento', async () => {
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
			expect(deps.metricasService.agenda).toHaveBeenCalled();
			const call = (deps.metricasService.agenda as ReturnType<typeof vi.fn>).mock.calls[0];
			const de = call[0] as Date;
			const ate = call[1] as Date;
			const diffDays = (ate.getTime() - de.getTime()) / (1000 * 60 * 60 * 24);
			expect(diffDays).toBeCloseTo(7, 0);
		});
	});

	describe('REGISTRAR_EVENTO', () => {
		it('registra evento com leadId', async () => {
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
			expect(deps.eventoService.create).toHaveBeenCalledWith(
				expect.objectContaining({ leadId: 'lead-1', tipo: 'VENDA' }),
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
		it('retorna SERVICE_ERROR quando service lança exceção', async () => {
			const deps = makeDeps({
				leadService: {
					...makeDeps().leadService,
					create: vi.fn().mockRejectedValue(new Error('Duplicate key')),
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
