import { describe, expect, it } from 'vitest';
import { parseAllowedOrigins } from '../../src/middlewares/cors.middleware.js';

describe('parseAllowedOrigins', () => {
	it('undefined/empty → nenhuma origem', () => {
		expect(parseAllowedOrigins(undefined)).toEqual([]);
		expect(parseAllowedOrigins('')).toEqual([]);
		expect(parseAllowedOrigins('   ')).toEqual([]);
	});

	it('separa por vírgula, trim e remove barra final', () => {
		expect(parseAllowedOrigins('https://panel.example.com/, http://localhost:5173 ')).toEqual([
			'https://panel.example.com',
			'http://localhost:5173',
		]);
	});

	it('ignora entradas vazias', () => {
		expect(parseAllowedOrigins('https://a.com,, ,https://b.com')).toEqual([
			'https://a.com',
			'https://b.com',
		]);
	});

	it('configuração "*" não casa com origem real (comparação literal, sem wildcard)', () => {
		// buildCors usa allowed.includes(origin): '*' só casaria com a origem literal "*",
		// que nenhum browser envia. Ou seja, '*' na config é inerte — nunca vira ACAO: *.
		const allowed = parseAllowedOrigins('*');
		expect(allowed.includes('https://panel.example.com')).toBe(false);
	});
});
