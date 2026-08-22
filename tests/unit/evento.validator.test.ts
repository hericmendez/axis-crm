import { describe, expect, it } from 'vitest';
import {
	createEventoSchema,
	leadIdParamSchema,
	periodoQuerySchema,
} from '../../src/validators/evento.validator.js';

describe('createEventoSchema', () => {
	it('aceita payload válido sem data', () => {
		const parsed = createEventoSchema.safeParse({ tipo: 'AGENDAMENTO' });
		expect(parsed.success).toBe(true);
	});

	it('aceita data ISO 8601', () => {
		const parsed = createEventoSchema.safeParse({
			tipo: 'VENDA',
			data: '2026-09-01T10:00:00Z',
			observacoes: 'fechamento',
		});
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.data).toBeInstanceOf(Date);
		}
	});

	it('rejeita tipo NENHUM ou inválido', () => {
		expect(createEventoSchema.safeParse({ tipo: 'NENHUM' }).success).toBe(false);
	});

	it('remove campos desconhecidos', () => {
		const parsed = createEventoSchema.safeParse({ tipo: 'VENDA', extra: 1 });
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect('extra' in parsed.data).toBe(false);
		}
	});
});

describe('leadIdParamSchema', () => {
	it('rejeita ObjectId inválido', () => {
		expect(leadIdParamSchema.safeParse({ id: 'abc' }).success).toBe(false);
	});

	it('aceita ObjectId válido', () => {
		const parsed = leadIdParamSchema.safeParse({ id: '507f1f77bcf86cd799439011' });
		expect(parsed.success).toBe(true);
	});
});

describe('periodoQuerySchema', () => {
	it('valida intervalo ISO inclusivo/exclusivo', () => {
		const parsed = periodoQuerySchema.safeParse({
			de: '2026-09-01T10:00:00Z',
			ate: '2026-09-02T10:00:00Z',
		});
		expect(parsed.success).toBe(true);
	});

	it('rejeita quando de >= ate', () => {
		expect(
			periodoQuerySchema.safeParse({
				de: '2026-09-02T10:00:00Z',
				ate: '2026-09-01T10:00:00Z',
			}).success,
		).toBe(false);
	});
});
