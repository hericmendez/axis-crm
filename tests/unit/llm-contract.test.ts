import { describe, expect, it, vi } from 'vitest';
import { routeIntent, type IntentRouterDeps } from '../../src/ai/intent-router.js';
import type { StructuredOutput } from '../../src/types/ai.js';
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
			createLead: makeTool({ type: 'SUCCESS', message: 'Lead criado: João (16999999999).' }),
			updateLead: makeTool({ type: 'SUCCESS', message: 'Lead atualizado: João.' }),
			registerEvent: makeTool({ type: 'SUCCESS', message: 'Evento registrado: AGENDAMENTO para João.' }),
			consultAgenda: makeTool({ type: 'SUCCESS', message: 'Agendamentos:\n- João (01/09/2026)' }),
		},
		...overrides,
	};
}

describe('LLM output → Router (contract tests)', () => {
	describe('caso original 1: "Call com Pedro Lucas"', () => {
		it('LLM output com leadRef → Entity Resolution FOUND → Tool executado', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([
						{ id: 'lead-103', nome: 'Pedro Lucas', telefone: '31999876543' },
					]),
				},
			});

			const llmOutput: StructuredOutput = {
				mode: 'ACTION',
				intent: 'REGISTRAR_EVENTO',
				confidence: 0.95,
				parameters: {
					leadRef: 'Pedro Lucas',
					tipo: 'AGENDAMENTO',
					data: '2026-08-31T14:00:00',
				},
			};

			const result = await routeIntent(llmOutput, deps);

			expect(result.type).toBe('SUCCESS');
			expect(deps.leadRepository.findByName).toHaveBeenCalledWith('Pedro Lucas');
			expect(deps.tools.registerEvent.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					leadId: 'lead-103',
					tipo: 'AGENDAMENTO',
					leadNome: 'Pedro Lucas',
				}),
			);
		});

		it('LLM output com leadRef inexistente → ENTITY_NOT_FOUND', async () => {
			const deps = makeDeps();

			const llmOutput: StructuredOutput = {
				mode: 'ACTION',
				intent: 'REGISTRAR_EVENTO',
				confidence: 0.95,
				parameters: {
					leadRef: 'Pedro Lucas',
					tipo: 'AGENDAMENTO',
				},
			};

			const result = await routeIntent(llmOutput, deps);
			expect(result.type).toBe('ENTITY_NOT_FOUND');
		});

		it('LLM output com leadRef ambíguo → AMBIGUOUS_ENTITY', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([
						{ id: 'lead-1', nome: 'Pedro Lucas', telefone: '11111111111' },
						{ id: 'lead-2', nome: 'Pedro Lucas', telefone: '22222222222' },
					]),
				},
			});

			const llmOutput: StructuredOutput = {
				mode: 'ACTION',
				intent: 'REGISTRAR_EVENTO',
				confidence: 0.95,
				parameters: {
					leadRef: 'Pedro Lucas',
					tipo: 'AGENDAMENTO',
				},
			};

			const result = await routeIntent(llmOutput, deps);
			expect(result.type).toBe('AMBIGUOUS_ENTITY');
			if (result.type === 'AMBIGUOUS_ENTITY') {
				expect(result.candidates).toHaveLength(2);
			}
		});
	});

	describe('caso original 2: "Call para Lead 101"', () => {
		it('LLM output com leadId → Entity Resolution FOUND → Tool executado', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findById: vi.fn().mockResolvedValue({ id: '101', nome: 'João Silva', telefone: '11111111111' }),
				},
			});

			const llmOutput: StructuredOutput = {
				mode: 'ACTION',
				intent: 'REGISTRAR_EVENTO',
				confidence: 0.96,
				parameters: {
					leadId: '101',
					tipo: 'AGENDAMENTO',
					data: '2026-08-31T14:00:00',
				},
			};

			const result = await routeIntent(llmOutput, deps);

			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.registerEvent.execute).toHaveBeenCalledWith(
				expect.objectContaining({
					leadId: '101',
					tipo: 'AGENDAMENTO',
					leadNome: 'João Silva',
				}),
			);
		});

		it('LLM output com leadId E tipo → nenhum MISSING_PARAMETERS', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findById: vi.fn().mockResolvedValue({ id: '101', nome: 'João Silva', telefone: '11111111111' }),
				},
			});

			const llmOutput: StructuredOutput = {
				mode: 'ACTION',
				intent: 'REGISTRAR_EVENTO',
				confidence: 0.96,
				parameters: { leadId: '101', tipo: 'AGENDAMENTO', data: '2026-08-28T14:00:00' },
			};

			const result = await routeIntent(llmOutput, deps);
			expect(result.type).not.toBe('MISSING_PARAMETERS');
		});

		it('LLM output SEM tipo → MISSING_PARAMETERS contém tipo', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findById: vi.fn().mockResolvedValue({ id: '101', nome: 'João Silva', telefone: '11111111111' }),
				},
			});

			const llmOutput: StructuredOutput = {
				mode: 'ACTION',
				intent: 'REGISTRAR_EVENTO',
				confidence: 0.9,
				parameters: { leadId: '101' },
			};

			const result = await routeIntent(llmOutput, deps);
			expect(result.type).toBe('MISSING_PARAMETERS');
			if (result.type === 'MISSING_PARAMETERS') {
				expect(result.missing).toContain('tipo');
			}
		});
	});

	describe('variações semânticas (outputs reais do LLM)', () => {
		it('"liga pro Pedro" → leadRef Pedro, tipo AGENDAMENTO', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'Pedro', telefone: '11111111111' }]),
				},
			});

			const result = await routeIntent(
				{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' } },
				deps,
				'liga pro Pedro amanhã',
			);
			expect(result.type).toBe('SUCCESS');
		});

		it('"marque uma call com Pedro" → leadRef Pedro, tipo AGENDAMENTO', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'Pedro', telefone: '11111111111' }]),
				},
			});

			const result = await routeIntent(
				{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' } },
				deps,
				'marque uma call com Pedro amanhã',
			);
			expect(result.type).toBe('SUCCESS');
		});

		it('"quero falar com Pedro na segunda" → leadRef Pedro, tipo AGENDAMENTO', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'Pedro', telefone: '11111111111' }]),
				},
			});

			const result = await routeIntent(
				{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.94, parameters: { leadRef: 'Pedro', tipo: 'AGENDAMENTO' } },
				deps,
				'quero falar com Pedro na segunda',
			);
			expect(result.type).toBe('SUCCESS');
		});

		it('"agenda uma reunião com João" → leadRef João, tipo AGENDAMENTO', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'João', telefone: '11111111111' }]),
				},
			});

			const result = await routeIntent(
				{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'João', tipo: 'AGENDAMENTO' } },
				deps,
				'agenda uma reunião com João sexta',
			);
			expect(result.type).toBe('SUCCESS');
		});

		it('"marca uma demo com Maria" → leadRef Maria, tipo AGENDAMENTO', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'Maria', telefone: '11111111111' }]),
				},
			});

			const result = await routeIntent(
				{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Maria', tipo: 'AGENDAMENTO' } },
				deps,
				'marca uma demo com Maria amanhã às 15h',
			);
			expect(result.type).toBe('SUCCESS');
		});

		it('"coloca uma visita para Carlos" → leadRef Carlos, tipo AGENDAMENTO', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'Carlos', telefone: '11111111111' }]),
				},
			});

			const result = await routeIntent(
				{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadRef: 'Carlos', tipo: 'AGENDAMENTO' } },
				deps,
				'coloca uma visita para Carlos dia 30 às 10h',
			);
			expect(result.type).toBe('SUCCESS');
		});

		it('"registre uma venda para o lead 101" → leadId 101, tipo VENDA', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findById: vi.fn().mockResolvedValue({ id: '101', nome: 'João', telefone: '11111111111' }),
				},
			});

			const result = await routeIntent(
				{ mode: 'ACTION', intent: 'REGISTRAR_EVENTO', confidence: 0.95, parameters: { leadId: '101', tipo: 'VENDA' } },
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(deps.tools.registerEvent.execute).toHaveBeenCalledWith(
				expect.objectContaining({ tipo: 'VENDA' }),
			);
		});
	});

	describe('outros cenários', () => {
		it('CRIAR_LEAD com todos os parâmetros', async () => {
			const deps = makeDeps();
			const result = await routeIntent(
				{ mode: 'ACTION', intent: 'CRIAR_LEAD', confidence: 0.95, parameters: { nome: 'Ana', telefone: '11999999999' } },
				deps,
			);
			expect(result.type).toBe('SUCCESS');
		});

		it('ATUALIZAR_LEAD com leadRef', async () => {
			const deps = makeDeps({
				leadRepository: {
					...makeDeps().leadRepository,
					findByName: vi.fn().mockResolvedValue([{ id: 'lead-1', nome: 'João', telefone: '11111111111' }]),
				},
			});
			const result = await routeIntent(
				{ mode: 'ACTION', intent: 'ATUALIZAR_LEAD', confidence: 0.9, parameters: { leadRef: 'João', status: 'VENDIDO' } },
				deps,
			);
			expect(result.type).toBe('SUCCESS');
		});

		it('CONVERSAR continua funcionando', async () => {
			const deps = makeDeps();
			const result = await routeIntent(
				{ mode: 'CHAT', confidence: 0.9, response: 'Olá!' },
				deps,
			);
			expect(result.type).toBe('SUCCESS');
			expect(result.message).toBe('Olá!');
		});
	});
});
