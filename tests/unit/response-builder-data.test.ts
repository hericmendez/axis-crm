import { describe, expect, it } from 'vitest';
import { buildResponse } from '../../src/ai/response-builder.js';
import type { OrchestratorResult } from '../../src/ai/errors.js';

describe('response-builder — MISSING_PARAMETERS', () => {
	it('usa mensagem contextual quando disponível', () => {
		const result: OrchestratorResult = {
			type: 'MISSING_PARAMETERS',
			missing: ['data'],
			message: 'Para qual data e horário devo agendar com Pedro?',
		};
		expect(buildResponse(result)).toBe('Para qual data e horário devo agendar com Pedro?');
	});

	it('fallback genérico quando message é undefined', () => {
		const result = {
			type: 'MISSING_PARAMETERS' as const,
			missing: ['nome', 'telefone'],
		};
		expect(buildResponse(result)).toBe('Para isso, preciso de mais informações: nome, telefone.');
	});
});
