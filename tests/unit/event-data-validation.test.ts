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
	const registerEventTool = makeTool({ type: 'SUCCESS', message: 'Evento registrado.' });
	return {
		leadService: {
			create: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' }),
			update: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' }),
			getById: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' }),
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
			createLead: makeTool({ type: 'SUCCESS', message: 'Lead criado.' }),
			updateLead: makeTool({ type: 'SUCCESS', message: 'Lead atualizado.' }),
			registerEvent: registerEventTool,
			consultAgenda: makeTool({ type: 'SUCCESS', message: 'Agendamentos.' }),
		},
		...overrides,
	};
}

describe('REGISTRAR_EVENTO — validação de data', () => {
	describe('AGENDAMENTO sem data → NÃO executa Tool', () => {
		it('retorna MISSING_PARAMETERS com mensagem contextual', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([
						{ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' },
					]),
				},
			});

			const result = await routeIntent(
				{
					intent: 'REGISTRAR_EVENTO',
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' },
					confidence: 0.9,
				},
				deps,
			);

			expect(result.type).toBe('MISSING_PARAMETERS');
			expect(result).toHaveProperty('missing');
			expect((result as { missing: string[] }).missing).toContain('data');
		});

		it('NÃO executa registerEvent.execute()', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([
						{ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' },
					]),
				},
			});

			await routeIntent(
				{
					intent: 'REGISTRAR_EVENTO',
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' },
					confidence: 0.9,
				},
				deps,
			);

			expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
		});

		it('mensagem inclui nome do lead', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([
						{ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' },
					]),
				},
			});

			const result = await routeIntent(
				{
					intent: 'REGISTRAR_EVENTO',
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' },
					confidence: 0.9,
				},
				deps,
			);

			expect(result).toHaveProperty('message');
			expect((result as { message: string }).message).toContain('Pedro');
		});
	});

	describe('REAGENDAMENTO sem data → NÃO executa Tool', () => {
		it('retorna MISSING_PARAMETERS', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([
						{ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' },
					]),
				},
			});

			const result = await routeIntent(
				{
					intent: 'REGISTRAR_EVENTO',
					parameters: { leadRef: 'Pedro', tipo: 'REAGENDAMENTO' },
					confidence: 0.9,
				},
				deps,
			);

			expect(result.type).toBe('MISSING_PARAMETERS');
			expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
		});
	});

	describe('AGENDAMENTO com data → executa Tool', () => {
		it('chama registerEvent com data', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([
						{ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' },
					]),
				},
			});

			const result = await routeIntent(
				{
					intent: 'REGISTRAR_EVENTO',
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO', data: '2026-08-28T14:00:00' },
					confidence: 0.9,
				},
				deps,
			);

			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.registerEvent.execute).toHaveBeenCalled();
		});
	});

	describe('REAGENDAMENTO com data → executa Tool', () => {
		it('chama registerEvent com data', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([
						{ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' },
					]),
				},
			});

			const result = await routeIntent(
				{
					intent: 'REGISTRAR_EVENTO',
					parameters: { leadRef: 'Pedro', tipo: 'REAGENDAMENTO', data: '2026-08-29T10:00:00' },
					confidence: 0.9,
				},
				deps,
			);

			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.registerEvent.execute).toHaveBeenCalled();
		});
	});

	describe('VENDA/DESISTENCIA/NO_SHOW sem data → executa Tool', () => {
		const tiposSemData = ['VENDA', 'DESISTENCIA', 'NO_SHOW'] as const;

		for (const tipo of tiposSemData) {
			it(`${tipo} sem data → executa registerEvent`, async () => {
				const deps = makeDeps({
					leadRepository: {
						...makeDeps().leadRepository,
						findByName: vi.fn().mockResolvedValue([
							{ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' },
						]),
					},
				});

				const result = await routeIntent(
					{
						intent: 'REGISTRAR_EVENTO',
						parameters: { leadRef: 'Pedro', tipo },
						confidence: 0.9,
					},
					deps,
				);

				expect(result.type).toBe('SUCCESS');
				expect(deps.tools.registerEvent.execute).toHaveBeenCalled();
			});
		}
	});

	describe('AGENDAMENTO com data via parser fallback', () => {
		it('extrai data de userMessage quando LLM não fornece', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([
						{ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' },
					]),
				},
			});

			const result = await routeIntent(
				{
					intent: 'REGISTRAR_EVENTO',
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' },
					confidence: 0.9,
				},
				deps,
				'agenda com Pedro amanhã às 14h',
			);

			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.registerEvent.execute).toHaveBeenCalled();
		});
	});

	describe('compatibilidade sem userMessage', () => {
		it('AGENDAMENTO sem data e sem userMessage → MISSING_PARAMETERS', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([
						{ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' },
					]),
				},
			});

			const result = await routeIntent(
				{
					intent: 'REGISTRAR_EVENTO',
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' },
					confidence: 0.9,
				},
				deps,
			);

			expect(result.type).toBe('MISSING_PARAMETERS');
		});
	});
});
