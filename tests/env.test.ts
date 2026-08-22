import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const validEnv = {
	NODE_ENV: 'test',
	PORT: '3000',
	MONGO_URI: 'mongodb://localhost:27017/test',
};

describe('loadEnv', () => {
	it('aceita env válido e aplica defaults', () => {
		const env = loadEnv(validEnv);
		expect(env.PORT).toBe(3000);
		expect(env.NODE_ENV).toBe('test');
	});

	it('falha sem MONGO_URI', () => {
		expect(() => loadEnv({ NODE_ENV: 'test', PORT: '3000' })).toThrow(/MONGO_URI/);
	});

	it('falha com PORT não numérico', () => {
		expect(() => loadEnv({ ...validEnv, PORT: 'abc' })).toThrow();
	});

	it('falha com NODE_ENV inválido', () => {
		expect(() => loadEnv({ ...validEnv, NODE_ENV: 'staging' })).toThrow();
	});
});
