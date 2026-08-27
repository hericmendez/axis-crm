import { describe, expect, it, vi } from 'vitest';
import { routeIntent, type IntentRouterDeps } from '../../src/ai/intent-router.js';
import { parseRelativeDateTime } from '../../src/ai/date-parser.js';
import { validateDateTime } from '../../src/ai/date-validator.js';
import type { InternalTool } from '../../src/ai/tools/internal-tool.js';
import type { OrchestratorResult } from '../../src/ai/errors.js';

function makeTool(result: OrchestratorResult): InternalTool {
	return { execute: vi.fn().mockResolvedValue(result) };
}

function makeDeps(overrides: Partial<IntentRouterDeps> = {}): IntentRouterDeps {
	return {
		leadService: {
			create: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'Pedro Lucas', telefone: '16999999999' }),
			update: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'Pedro Lucas', telefone: '16999999999' }),
			getById: vi.fn().mockResolvedValue({ id: 'lead-1', nome: 'Pedro Lucas', telefone: '16999999999' }),
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

function foundLead(deps: IntentRouterDeps, lead?: { id: string; nome: string; telefone: string }): void {
	(deps.leadRepository.findByName as ReturnType<typeof vi.fn>).mockResolvedValue([
		lead ?? { id: 'lead-1', nome: 'Pedro Lucas', telefone: '16999999999' },
	]);
}

describe('HARDENING — Datas inválidas', () => {
	it('31/06/2026 às 14:30 → INVALID_DATE', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO', data: '2026-06-31T14:30:00' } },
			deps,
		);
		expect(result.type).toBe('INVALID_DATE');
		expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
	});

	it('30/02/2026 às 10h → INVALID_DATE', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO', data: '2026-02-30T10:00:00' } },
			deps,
		);
		expect(result.type).toBe('INVALID_DATE');
	});

	it('29/02/2025 às 8h → INVALID_DATE (não bissexto)', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO', data: '2025-02-29T08:00:00' } },
			deps,
		);
		expect(result.type).toBe('INVALID_DATE');
	});

	it('horário 25:00 → INVALID_DATE', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO', data: '2026-08-27T25:00:00' } },
			deps,
		);
		expect(result.type).toBe('INVALID_DATE');
	});

	it('horário 14:75 → INVALID_DATE', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO', data: '2026-08-27T14:75:00' } },
			deps,
		);
		expect(result.type).toBe('INVALID_DATE');
	});
});

describe('HARDENING — Datas passadas', () => {
	it('ontem às 14h (parser) → PAST_DATE', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' } },
			deps,
			'marque uma Call com Pedro Lucas para ontem às 14h',
		);
		expect(result.type).toBe('PAST_DATE');
		expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
	});

	it('01/01/2020 às 14h → PAST_DATE', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO', data: '2020-01-01T14:00:00' } },
			deps,
		);
		expect(result.type).toBe('PAST_DATE');
	});

	it('terça-feira semana passada às 16h → PAST_DATE', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' } },
			deps,
			'marque uma Call com Pedro Lucas para terça-feira da semana passada às 16h',
		);
		expect(result.type).toBe('PAST_DATE');
	});
});

describe('HARDENING — Datas relativas futuras', () => {
	it('amanhã às 14h (parser) → SUCCESS', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' } },
			deps,
			'marque uma Call com Pedro Lucas para amanhã às 14h',
		);
		expect(result.type).toBe('SUCCESS');
		expect(deps.tools.registerEvent.execute).toHaveBeenCalled();
	});

	it('anteontem às 14h → PAST_DATE (rejeitado)', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' } },
			deps,
			'marque uma Call com Pedro Lucas para anteontem às 14h',
		);
		expect(result.type).toBe('PAST_DATE');
	});

	it('próxima terça às 14h (parser) → SUCCESS', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' } },
			deps,
			'marque uma Call com Pedro Lucas para próxima terça às 14h',
		);
		expect(result.type).toBe('SUCCESS');
		expect(deps.tools.registerEvent.execute).toHaveBeenCalled();
	});

	it('terça-feira passada às 16h → PAST_DATE', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' } },
			deps,
			'marque uma Call com Pedro Lucas para terça-feira passada às 16h',
		);
		expect(result.type).toBe('PAST_DATE');
	});
});

describe('HARDENING — Caso feliz preservado', () => {
	it('31/08/2026 às 14:30 → SUCCESS', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO', data: '2026-08-31T14:30:00' } },
			deps,
		);
		expect(result.type).toBe('SUCCESS');
		expect(deps.tools.registerEvent.execute).toHaveBeenCalled();
	});

	it('VENDA sem data → SUCCESS', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'VENDA' } },
			deps,
		);
		expect(result.type).toBe('SUCCESS');
	});

	it('REAGENDAMENTO com data futura → SUCCESS', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'REAGENDAMENTO', data: '2026-09-05T10:00:00' } },
			deps,
		);
		expect(result.type).toBe('SUCCESS');
	});
});

describe('HARDENING — Dados insuficientes', () => {
	it('AGENDAMENTO sem data → MISSING_PARAMETERS', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' } },
			deps,
		);
		expect(result.type).toBe('MISSING_PARAMETERS');
		expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
	});

	it('REGISTRAR_EVENTO sem tipo → MISSING_PARAMETERS', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas' } },
			deps,
		);
		expect(result.type).toBe('MISSING_PARAMETERS');
	});

	it('REGISTRAR_EVENTO sem lead → MISSING_PARAMETERS', async () => {
		const deps = makeDeps();
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { tipo: 'AGENDAMENTO', data: '2026-08-31T14:00:00' } },
			deps,
		);
		expect(result.type).toBe('MISSING_PARAMETERS');
	});
});

describe('HARDENING — Validação determinística (sem LLM)', () => {
	it('validateDateTime detecta overflow de 31/06', () => {
		const r = validateDateTime('2026-06-31T14:30:00');
		expect(r.valid).toBe(false);
		if (!r.valid) expect(r.code).toBe('INVALID_DATE');
	});

	it('validateDateTime aceita 31/08 válido', () => {
		const r = validateDateTime('2026-08-31T14:30:00');
		expect(r.valid).toBe(true);
	});

	it('parseRelativeDateTime interpreta "ontem"', () => {
		const now = new Date(2026, 7, 27, 10, 0, 0);
		const r = parseRelativeDateTime('ontem às 14h', now);
		expect(r).not.toBeNull();
		expect(r!.date.getDate()).toBe(26);
	});

	it('parseRelativeDateTime interpreta "terça-feira da semana passada"', () => {
		const now = new Date(2026, 7, 27, 10, 0, 0);
		const r = parseRelativeDateTime('terça-feira da semana passada às 16h', now);
		expect(r).not.toBeNull();
		expect(r!.date.getDay()).toBe(2); // terça
		expect(r!.date.getDate()).toBe(25);
	});

	it('parseRelativeDateTime interpreta "próxima segunda"', () => {
		const now = new Date(2026, 7, 27, 10, 0, 0);
		const r = parseRelativeDateTime('próxima segunda às 10h', now);
		expect(r).not.toBeNull();
		expect(r!.date.getDay()).toBe(1);
		expect(r!.date.getDate()).toBe(31);
	});
});
