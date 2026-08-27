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
			create: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' }),
			update: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' }),
			getById: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' }),
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
			createLead: makeTool({ type: 'SUCCESS', message: 'Lead criado.' }),
			updateLead: makeTool({ type: 'SUCCESS', message: 'Lead atualizado.' }),
			registerEvent: makeTool({ type: 'SUCCESS', message: 'Evento registrado.' }),
			consultAgenda: makeTool({ type: 'SUCCESS', message: 'Agendamentos.' }),
		},
		...overrides,
	};
}

function foundLead(deps: IntentRouterDeps): void {
	(deps.leadRepository.findByName as ReturnType<typeof vi.fn>).mockResolvedValue([
		{ id: 'lead-1', nome: 'Pedro', telefone: '16999999999' },
	]);
}

describe('REGISTRAR_EVENTO — validação de datas (integração Router)', () => {
	describe('datas inválidas (overflow)', () => {
		it('31/06/2026 → INVALID_DATE', async () => {
			const deps = makeDeps();
			foundLead(deps);
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO', data: '2026-06-31T14:30:00' },
				},
				deps,
			);
			expect(result.type).toBe('INVALID_DATE');
			expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
		});

		it('30/02/2026 → INVALID_DATE', async () => {
			const deps = makeDeps();
			foundLead(deps);
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO', data: '2026-02-30T10:00:00' },
				},
				deps,
			);
			expect(result.type).toBe('INVALID_DATE');
			expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
		});

		it('29/02/2025 → INVALID_DATE (não bissexto)', async () => {
			const deps = makeDeps();
			foundLead(deps);
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO', data: '2025-02-29T08:00:00' },
				},
				deps,
			);
			expect(result.type).toBe('INVALID_DATE');
			expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
		});
	});

	describe('horários inválidos', () => {
		it('25:00 → INVALID_DATE (overflow de hora)', async () => {
			const deps = makeDeps();
			foundLead(deps);
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO', data: '2026-08-27T25:00:00' },
				},
				deps,
			);
			expect(result.type).toBe('INVALID_DATE');
			expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
		});
	});

	describe('data passada para AGENDAMENTO', () => {
		it('ontem → PAST_DATE', async () => {
			const deps = makeDeps();
			foundLead(deps);
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' },
				},
				deps,
				'marque uma Call com Pedro para ontem às 14h',
			);
			expect(result.type).toBe('PAST_DATE');
			expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
		});

		it('01/01/2020 → PAST_DATE', async () => {
			const deps = makeDeps();
			foundLead(deps);
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO', data: '2020-01-01T14:00:00' },
				},
				deps,
			);
			expect(result.type).toBe('PAST_DATE');
			expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
		});
	});

	describe('datas futuras válidas', () => {
		it('31/08/2026 14:30 → SUCCESS', async () => {
			const deps = makeDeps();
			foundLead(deps);
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO', data: '2026-08-31T14:30:00' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.registerEvent.execute).toHaveBeenCalled();
		});

		it('amanhã às 14h (parser) → SUCCESS', async () => {
			const deps = makeDeps();
			foundLead(deps);
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' },
				},
				deps,
				'marque uma Call com Pedro para amanhã às 14h',
			);
			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.registerEvent.execute).toHaveBeenCalled();
		});
	});

	describe('VENDA/DESISTENCIA/NO_SHOW sem data → não rejeita', () => {
		it('VENDA sem data → executa com new Date()', async () => {
			const deps = makeDeps();
			foundLead(deps);
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadRef: 'Pedro', tipo: 'VENDA' },
				},
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.registerEvent.execute).toHaveBeenCalled();
		});
	});

	describe('parser com expressões estendidas', () => {
		it('terça-feira da semana passada → não rejeita (data extraída pelo parser)', async () => {
			const deps = makeDeps();
			foundLead(deps);
			const result = await routeIntent(
				{
					mode: 'ACTION',
					intent: 'REGISTRAR_EVENTO',
					confidence: 0.95,
					parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' },
				},
				deps,
				'marque uma Call com Pedro para terça-feira da semana passada às 16h',
			);
			// A data pode ser passada (PAST_DATE) ou não — depende de "semana passada" ser futuro ou passado
			// Neste caso, "semana passada" = passado → PAST_DATE
			expect(result.type).toBe('PAST_DATE');
			expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
		});
	});
});
