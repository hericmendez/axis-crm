import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../src/config/env.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/config/env.js')>();
	return {
		...actual,
		getEnv: () => ({ ...actual.getEnv(), AUTH_LOGIN_WINDOW_MS: 60000, AUTH_LOGIN_MAX: 2 }),
	};
});

import { authRateLimit } from '../../src/middlewares/auth-rate-limit.middleware.js';

function req(ip: string, body?: unknown) {
	return { ip, body } as unknown as Request;
}

describe('authRateLimit', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('permite até o limite e rejeita o excedente com 429', () => {
		const r = () => req('9.9.9.9', { email: 'victim@example.com' });
		expect(pass(r())).toBe(true);
		expect(pass(r())).toBe(true);
		const next = vi.fn();
		authRateLimit(r(), {} as Response, next);
		expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 429 }));
	});

	it('emails diferentes têm buckets separados', () => {
		const next = vi.fn();
		authRateLimit(req('9.9.9.8', { email: 'a@example.com' }), {} as Response, next);
		authRateLimit(req('9.9.9.8', { email: 'b@example.com' }), {} as Response, next);
		authRateLimit(req('9.9.9.8', { email: 'a@example.com' }), {} as Response, next);
		expect(next).toHaveBeenCalledTimes(3);
		expect(next).toHaveBeenCalledWith();
	});

	it('normaliza email (case/trim) na chave', () => {
		const next = vi.fn();
		authRateLimit(req('9.9.9.7', { email: '  User@Example.com ' }), {} as Response, next);
		authRateLimit(req('9.9.9.7', { email: 'user@example.com' }), {} as Response, next);
		authRateLimit(req('9.9.9.7', { email: 'USER@EXAMPLE.COM' }), {} as Response, next);
		expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ statusCode: 429 }));
	});

	it('body ausente/malformado não quebra', () => {
		const next = vi.fn();
		authRateLimit(req('9.9.9.6'), {} as Response, next);
		authRateLimit(req('9.9.9.6', null), {} as Response, next);
		expect(next).toHaveBeenCalledTimes(2);
	});

	function pass(r: Request): boolean {
		const next = vi.fn();
		authRateLimit(r, {} as Response, next);
		return next.mock.calls[0]?.[0] === undefined;
	}
});
