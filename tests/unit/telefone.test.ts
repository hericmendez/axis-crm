import { describe, expect, it } from 'vitest';
import { normalizeTelefone } from '../../src/utils/telefone.js';

describe('normalizeTelefone', () => {
	it('remove máscaras e formatação', () => {
		expect(normalizeTelefone('(11) 91234-5678')).toBe('11912345678');
		expect(normalizeTelefone('+55 11 91234-5678')).toBe('5511912345678');
		expect(normalizeTelefone('11.91234.5678')).toBe('11912345678');
	});

	it('mantém número já normalizado', () => {
		expect(normalizeTelefone('11912345678')).toBe('11912345678');
	});

	it('números com máscara diferente geram o mesmo valor canônico', () => {
		expect(normalizeTelefone('(11) 91234-5678')).toBe(normalizeTelefone('11912345678'));
	});

	it('rejeita telefone com poucos dígitos', () => {
		expect(() => normalizeTelefone('999')).toThrow(RangeError);
	});

	it('rejeita telefone com dígitos demais', () => {
		expect(() => normalizeTelefone('1'.repeat(16))).toThrow(RangeError);
	});
});
