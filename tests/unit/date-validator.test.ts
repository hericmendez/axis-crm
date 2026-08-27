import { describe, expect, it } from 'vitest';
import { validateDateTime, validateDateComponents, validateTime } from '../../src/ai/date-validator.js';

describe('date-validator', () => {
	describe('validateDateComponents', () => {
		it('31/06 → inválido (junho tem 30 dias)', () => {
			const r = validateDateComponents(2026, 6, 31);
			expect(r).not.toBeNull();
			expect(r!.code).toBe('INVALID_DATE');
		});

		it('30/02 → inválido (fevereiro tem 28/29 dias)', () => {
			const r = validateDateComponents(2026, 2, 30);
			expect(r).not.toBeNull();
			expect(r!.code).toBe('INVALID_DATE');
		});

		it('29/02/2025 → inválido (2025 não é bissexto)', () => {
			const r = validateDateComponents(2025, 2, 29);
			expect(r).not.toBeNull();
			expect(r!.code).toBe('INVALID_DATE');
		});

		it('29/02/2024 → válido (2024 é bissexto)', () => {
			const r = validateDateComponents(2024, 2, 29);
			expect(r).toBeNull();
		});

		it('31/08/2026 → válido', () => {
			const r = validateDateComponents(2026, 8, 31);
			expect(r).toBeNull();
		});

		it('mês 13 → inválido', () => {
			const r = validateDateComponents(2026, 13, 1);
			expect(r).not.toBeNull();
			expect(r!.code).toBe('INVALID_DATE');
		});

		it('dia 0 → inválido', () => {
			const r = validateDateComponents(2026, 1, 0);
			expect(r).not.toBeNull();
			expect(r!.code).toBe('INVALID_DATE');
		});

		it('31/12/2026 → válido', () => {
			const r = validateDateComponents(2026, 12, 31);
			expect(r).toBeNull();
		});
	});

	describe('validateTime', () => {
		it('25:00 → inválido', () => {
			const r = validateTime(25, 0);
			expect(r).not.toBeNull();
			expect(r!.code).toBe('INVALID_TIME');
		});

		it('14:75 → inválido', () => {
			const r = validateTime(14, 75);
			expect(r).not.toBeNull();
			expect(r!.code).toBe('INVALID_TIME');
		});

		it('24:01 → inválido', () => {
			const r = validateTime(24, 1);
			expect(r).not.toBeNull();
			expect(r!.code).toBe('INVALID_TIME');
		});

		it('14:60 → inválido', () => {
			const r = validateTime(14, 60);
			expect(r).not.toBeNull();
			expect(r!.code).toBe('INVALID_TIME');
		});

		it('-1:00 → inválido', () => {
			const r = validateTime(-1, 0);
			expect(r).not.toBeNull();
			expect(r!.code).toBe('INVALID_TIME');
		});

		it('14:30 → válido', () => {
			const r = validateTime(14, 30);
			expect(r).toBeNull();
		});

		it('0:00 → válido', () => {
			const r = validateTime(0, 0);
			expect(r).toBeNull();
		});

		it('23:59 → válido', () => {
			const r = validateTime(23, 59);
			expect(r).toBeNull();
		});
	});

	describe('validateDateTime — datas ISO inválidas', () => {
		it('2026-06-31T14:30:00 → INVALID_DATE (overflow)', () => {
			const r = validateDateTime('2026-06-31T14:30:00');
			expect(r.valid).toBe(false);
			if (!r.valid) {
				expect(r.code).toBe('INVALID_DATE');
			}
		});

		it('2026-02-30T10:00:00 → INVALID_DATE', () => {
			const r = validateDateTime('2026-02-30T10:00:00');
			expect(r.valid).toBe(false);
			if (!r.valid) {
				expect(r.code).toBe('INVALID_DATE');
			}
		});

		it('2025-02-29T08:00:00 → INVALID_DATE (não bissexto)', () => {
			const r = validateDateTime('2025-02-29T08:00:00');
			expect(r.valid).toBe(false);
			if (!r.valid) {
				expect(r.code).toBe('INVALID_DATE');
			}
		});

		it('2024-02-29T08:00:00 → válido (bissexto)', () => {
			const r = validateDateTime('2024-02-29T08:00:00');
			expect(r.valid).toBe(true);
		});
	});

	describe('validateDateTime — horários inválidos em ISO', () => {
		it('2026-08-27T25:00:00 → INVALID_TIME', () => {
			const r = validateDateTime('2026-08-27T25:00:00');
			expect(r.valid).toBe(false);
			if (!r.valid) {
				expect(r.code).toBe('INVALID_TIME');
			}
		});

		it('2026-08-27T14:75:00 → INVALID_TIME', () => {
			const r = validateDateTime('2026-08-27T14:75:00');
			expect(r.valid).toBe(false);
			if (!r.valid) {
				expect(r.code).toBe('INVALID_TIME');
			}
		});
	});

	describe('validateDateTime — datas válidas', () => {
		it('2026-08-31T14:30:00 → válido', () => {
			const r = validateDateTime('2026-08-31T14:30:00');
			expect(r.valid).toBe(true);
		});

		it('2026-12-31T23:59:00 → válido', () => {
			const r = validateDateTime('2026-12-31T23:59:00');
			expect(r.valid).toBe(true);
		});

		it('2026-01-01T00:00:00 → válido', () => {
			const r = validateDateTime('2026-01-01T00:00:00');
			expect(r.valid).toBe(true);
		});
	});

	describe('validateDateTime — formato brasileiro', () => {
		it('31/08/2026 14:30 → válido', () => {
			const r = validateDateTime('31/08/2026 14:30');
			expect(r.valid).toBe(true);
		});

		it('31/06/2026 14:30 → INVALID_DATE', () => {
			const r = validateDateTime('31/06/2026 14:30');
			expect(r.valid).toBe(false);
			if (!r.valid) {
				expect(r.code).toBe('INVALID_DATE');
			}
		});
	});

	describe('validateDateTime — formato dia de mês', () => {
		it('dia 31 de agosto de 2026 às 14h → válido', () => {
			const r = validateDateTime('dia 31 de agosto de 2026 às 14h');
			expect(r.valid).toBe(true);
		});

		it('dia 31 de junho de 2026 às 14h → INVALID_DATE', () => {
			const r = validateDateTime('dia 31 de junho de 2026 às 14h');
			expect(r.valid).toBe(false);
			if (!r.valid) {
				expect(r.code).toBe('INVALID_DATE');
			}
		});
	});

	describe('validateDateTime — horário ausente', () => {
		it('2026-08-27 (sem horário) → válido com hadTime=false', () => {
			const r = validateDateTime('2026-08-27');
			expect(r.valid).toBe(true);
			if (r.valid) {
				expect(r.hadTime).toBe(false);
			}
		});
	});

	describe('validateDateTime — Invalid Date', () => {
		it('string vazia → INVALID_DATE', () => {
			const r = validateDateTime('');
			expect(r.valid).toBe(false);
			if (!r.valid) {
				expect(r.code).toBe('INVALID_DATE');
			}
		});

		it('string aleatória → INVALID_DATE', () => {
			const r = validateDateTime('abc def');
			expect(r.valid).toBe(false);
			if (!r.valid) {
				expect(r.code).toBe('INVALID_DATE');
			}
		});
	});
});
