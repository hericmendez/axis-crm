import { describe, expect, it, vi } from 'vitest';
import { routeIntent, type IntentRouterDeps } from '../../src/ai/intent-router.js';
import { parseRelativeDateTime } from '../../src/ai/date-parser.js';
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

describe('Invalid time — parseRelativeDateTime', () => {
	const now = new Date(2026, 7, 27, 10, 0, 0);

	it('25:99 → invalidTime=true, no overflow', () => {
		const r = parseRelativeDateTime('amanhã às 25:99', now);
		expect(r).not.toBeNull();
		expect(r!.invalidTime).toBe(true);
		expect(r!.hadTime).toBe(false);
		expect(r!.date.getDate()).toBe(28);
		expect(r!.date.getHours()).toBe(0);
		expect(r!.date.getMinutes()).toBe(0);
	});

	it('25:00 → invalidTime=true', () => {
		const r = parseRelativeDateTime('amanhã às 25:00', now);
		expect(r).not.toBeNull();
		expect(r!.invalidTime).toBe(true);
	});

	it('24:00 → invalidTime=true', () => {
		const r = parseRelativeDateTime('amanhã às 24:00', now);
		expect(r).not.toBeNull();
		expect(r!.invalidTime).toBe(true);
	});

	it('23:60 → invalidTime=true', () => {
		const r = parseRelativeDateTime('amanhã às 23:60', now);
		expect(r).not.toBeNull();
		expect(r!.invalidTime).toBe(true);
	});

	it('14:75 → invalidTime=true', () => {
		const r = parseRelativeDateTime('amanhã às 14:75', now);
		expect(r).not.toBeNull();
		expect(r!.invalidTime).toBe(true);
	});

	it('00:00 → valid', () => {
		const r = parseRelativeDateTime('amanhã às 00:00', now);
		expect(r).not.toBeNull();
		expect(r!.invalidTime).toBe(false);
		expect(r!.hadTime).toBe(true);
		expect(r!.date.getHours()).toBe(0);
		expect(r!.date.getMinutes()).toBe(0);
	});

	it('23:59 → valid', () => {
		const r = parseRelativeDateTime('amanhã às 23:59', now);
		expect(r).not.toBeNull();
		expect(r!.invalidTime).toBe(false);
		expect(r!.hadTime).toBe(true);
		expect(r!.date.getHours()).toBe(23);
		expect(r!.date.getMinutes()).toBe(59);
	});

	it('14:30 → valid', () => {
		const r = parseRelativeDateTime('amanhã às 14:30', now);
		expect(r).not.toBeNull();
		expect(r!.invalidTime).toBe(false);
		expect(r!.hadTime).toBe(true);
		expect(r!.date.getHours()).toBe(14);
		expect(r!.date.getMinutes()).toBe(30);
	});

	it('25h pattern (25h) → invalidTime=true', () => {
		const r = parseRelativeDateTime('amanhã às 25h', now);
		expect(r).not.toBeNull();
		expect(r!.invalidTime).toBe(true);
	});

	it('24h pattern → invalidTime=true', () => {
		const r = parseRelativeDateTime('amanhã às 24h', now);
		expect(r).not.toBeNull();
		expect(r!.invalidTime).toBe(true);
	});

	it('no time → invalidTime=false, hadTime=false', () => {
		const r = parseRelativeDateTime('amanhã', now);
		expect(r).not.toBeNull();
		expect(r!.invalidTime).toBe(false);
		expect(r!.hadTime).toBe(false);
	});
});

describe('Invalid time — Router integration', () => {
	it('amanhã às 25:99 → INVALID_TIME, tool NOT called', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' } },
			deps,
			'marque uma call com o Pedro Lucas para amanhã às 25:99',
		);
		expect(result.type).toBe('INVALID_TIME');
		expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
	});

	it('amanhã às 14:30 → SUCCESS, tool called', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' } },
			deps,
			'marque uma call com o Pedro Lucas para amanhã às 14:30',
		);
		expect(result.type).toBe('SUCCESS');
		expect(deps.tools.registerEvent.execute).toHaveBeenCalled();
	});

	it('amanhã às 25:00 → INVALID_TIME', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' } },
			deps,
			'marque uma call com o Pedro Lucas para amanhã às 25:00',
		);
		expect(result.type).toBe('INVALID_TIME');
		expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
	});

	it('amanhã às 24:00 → INVALID_TIME', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' } },
			deps,
			'marque uma call com o Pedro Lucas para amanhã às 24:00',
		);
		expect(result.type).toBe('INVALID_TIME');
	});

	it('amanhã às 23:60 → INVALID_TIME', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' } },
			deps,
			'marque uma call com o Pedro Lucas para amanhã às 23:60',
		);
		expect(result.type).toBe('INVALID_TIME');
	});

	it('amanhã às 14:75 → INVALID_TIME', async () => {
		const deps = makeDeps();
		foundLead(deps);
		const result = await routeIntent(
			{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro Lucas', tipo: 'AGENDAMENTO' } },
			deps,
			'marque uma call com o Pedro Lucas para amanhã às 14:75',
		);
		expect(result.type).toBe('INVALID_TIME');
	});
});

describe('Invalid time — no day overflow', () => {
	const now = new Date(2026, 7, 27, 10, 0, 0);

	it('25:99 does NOT overflow to next day', () => {
		const r = parseRelativeDateTime('amanhã às 25:99', now);
		expect(r).not.toBeNull();
		expect(r!.date.getDate()).toBe(28);
	});

	it('25:00 does NOT overflow to next day', () => {
		const r = parseRelativeDateTime('amanhã às 25:00', now);
		expect(r).not.toBeNull();
		expect(r!.date.getDate()).toBe(28);
	});

	it('14:75 does NOT overflow minutes into hours', () => {
		const r = parseRelativeDateTime('amanhã às 14:75', now);
		expect(r).not.toBeNull();
		expect(r!.date.getDate()).toBe(28);
	});
});
