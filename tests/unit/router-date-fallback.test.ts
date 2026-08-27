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
			createLead: makeTool({ type: 'SUCCESS', message: 'Lead criado.' }),
			updateLead: makeTool({ type: 'SUCCESS', message: 'Lead atualizado.' }),
			registerEvent: makeTool({ type: 'SUCCESS', message: 'Evento registrado.' }),
			consultAgenda: makeTool({ type: 'SUCCESS', message: 'Agendamentos.' }),
		},
		...overrides,
	};
}

describe('router date fallback', () => {
	it('usa data do LLM quando presente', async () => {
		const deps = makeDeps({
			leadRepository: {
				...makeDeps().leadRepository,
				findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'Pedro', telefone: '11111111111' }]),
			},
		});
		await routeIntent(
			{
				mode: 'ACTION',
				intent: 'REGISTRAR_EVENTO',
				confidence: 0.95,
				parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO', data: '2026-08-31T14:00:00' },
			},
			deps,
		);
		expect(deps.tools.registerEvent.execute).toHaveBeenCalledWith(
			expect.objectContaining({ data: expect.any(Date) }),
		);
		const call = (deps.tools.registerEvent.execute as ReturnType<typeof vi.fn>).mock.calls[0];
		const input = call[0] as { data: Date };
		expect(input.data.toISOString()).toContain('2026-08-31');
	});

	it('usa fallback do parser quando LLM não extrai data', async () => {
		const deps = makeDeps({
			leadRepository: {
				...makeDeps().leadRepository,
				findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'Pedro', telefone: '11111111111' }]),
			},
		});
		await routeIntent(
			{
				mode: 'ACTION',
				intent: 'REGISTRAR_EVENTO',
				confidence: 0.95,
				parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' },
			},
			deps,
			'agende uma Call com Pedro para amanhã às 10h',
		);
		expect(deps.tools.registerEvent.execute).toHaveBeenCalledWith(
			expect.objectContaining({ data: expect.any(Date) }),
		);
		const call = (deps.tools.registerEvent.execute as ReturnType<typeof vi.fn>).mock.calls[0];
		const input = call[0] as { data: Date };
		expect(input.data.getHours()).toBe(10);
	});

	it('não envia data quando nem LLM nem parser extraem → MISSING_PARAMETERS para AGENDAMENTO', async () => {
		const deps = makeDeps({
			leadRepository: {
				...makeDeps().leadRepository,
				findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'Pedro', telefone: '11111111111' }]),
			},
		});
		const result = await routeIntent(
			{
				mode: 'ACTION',
				intent: 'REGISTRAR_EVENTO',
				confidence: 0.95,
				parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' },
			},
			deps,
			'agende com Pedro',
		);
		expect(result.type).toBe('MISSING_PARAMETERS');
		expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
	});

	it('parser extrai "amanhã às 10h" quando LLM não extrai', async () => {
		const deps = makeDeps({
			leadRepository: {
				...makeDeps().leadRepository,
				findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'Pedro', telefone: '11111111111' }]),
			},
		});
		await routeIntent(
			{
				mode: 'ACTION',
				intent: 'REGISTRAR_EVENTO',
				confidence: 0.95,
				parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' },
			},
			deps,
			'agende uma reunião com Pedro amanhã às 10h',
		);
		const call = (deps.tools.registerEvent.execute as ReturnType<typeof vi.fn>).mock.calls[0];
		const input = call[0] as { data: Date; leadId: string };
		expect(input.data).toBeDefined();
		expect(input.data.getHours()).toBe(10);
	});

	it('parser extrai "sexta às 15h" quando LLM não extrai', async () => {
		const deps = makeDeps({
			leadRepository: {
				...makeDeps().leadRepository,
				findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'Maria', telefone: '11111111111' }]),
			},
		});
		await routeIntent(
			{
				mode: 'ACTION',
				intent: 'REGISTRAR_EVENTO',
				confidence: 0.95,
				parameters: { leadRef: 'Maria', tipo: 'AGENDAMENTO' },
			},
			deps,
			'marque uma demo com Maria sexta às 15h',
		);
		const call = (deps.tools.registerEvent.execute as ReturnType<typeof vi.fn>).mock.calls[0];
		const input = call[0] as { data: Date };
		expect(input.data).toBeDefined();
		expect(input.data.getHours()).toBe(15);
	});

	it('parser extrai "dia 31 às 14:30" quando LLM não extrai', async () => {
		const deps = makeDeps({
			leadRepository: {
				...makeDeps().leadRepository,
				findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'João', telefone: '11111111111' }]),
			},
		});
		await routeIntent(
			{
				mode: 'ACTION',
				intent: 'REGISTRAR_EVENTO',
				confidence: 0.95,
				parameters: { leadRef: 'João', tipo: 'AGENDAMENTO' },
			},
			deps,
			'agenda uma call com João dia 31 às 14:30',
		);
		const call = (deps.tools.registerEvent.execute as ReturnType<typeof vi.fn>).mock.calls[0];
		const input = call[0] as { data: Date };
		expect(input.data).toBeDefined();
		expect(input.data.getDate()).toBe(31);
		expect(input.data.getHours()).toBe(14);
		expect(input.data.getMinutes()).toBe(30);
	});

	it('AGENDAMENTO sem data e sem userMessage → MISSING_PARAMETERS', async () => {
		const deps = makeDeps({
			leadRepository: {
				...makeDeps().leadRepository,
				findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'Pedro', telefone: '11111111111' }]),
			},
		});
		const result = await routeIntent(
			{
				mode: 'ACTION',
				intent: 'REGISTRAR_EVENTO',
				confidence: 0.95,
				parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' },
			},
			deps,
		);
		expect(result.type).toBe('MISSING_PARAMETERS');
		expect(deps.tools.registerEvent.execute).not.toHaveBeenCalled();
	});
});
