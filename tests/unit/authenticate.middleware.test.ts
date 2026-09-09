import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../src/models/user.model.js', () => ({
	UserModel: { findOne: vi.fn() },
}));

vi.mock('../../src/config/env.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/config/env.js')>();
	return {
		...actual,
		getEnv: () => ({ ...actual.getEnv(), API_KEY: 'env-key' }),
	};
});

import { authenticate } from '../../src/middlewares/authenticate.middleware.js';
import { UserModel } from '../../src/models/user.model.js';
import { signAccessToken } from '../../src/auth/tokens.js';

function keyUser(id: string | null) {
	vi.mocked(UserModel.findOne).mockReturnValue({
		select: () => ({
			lean: () => Promise.resolve(id ? { _id: id } : null),
		}),
	} as never);
}

function req(headers: Record<string, string | undefined>, path = '/api/leads') {
	return {
		path,
		header: (name: string) => headers[name.toLowerCase()],
	} as unknown as Request;
}

describe('authenticate middleware', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		keyUser(null);
	});

	it('pula rotas públicas', async () => {
		const next = vi.fn();
		await authenticate(req({ authorization: 'Bearer lixo' }, '/health'), {} as Response, next);
		expect(next).toHaveBeenCalledWith();
	});

	it('sem Authorization → next sem identidade', async () => {
		const next = vi.fn();
		const r = req({});
		await authenticate(r, {} as Response, next);
		expect(next).toHaveBeenCalledWith();
		expect((r as Request & { userId?: string }).userId).toBeUndefined();
	});

	it('esquema não-Bearer → 401', async () => {
		const next = vi.fn();
		await authenticate(req({ authorization: 'Basic abc' }), {} as Response, next);
		expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
	});

	it('esquema Bearer case-insensitive (RFC 7235) → aceita', async () => {
		const next = vi.fn();
		const r = req({ authorization: `bearer ${signAccessToken('507f1f77bcf86cd799439011')}` });
		await authenticate(r, {} as Response, next);
		expect(next).toHaveBeenCalledWith();
		expect((r as Request & { userId?: string }).userId).toBe('507f1f77bcf86cd799439011');
	});

	it('sub fora do formato ObjectId → 401', async () => {
		const next = vi.fn();
		await authenticate(
			req({ authorization: `Bearer ${signAccessToken('not-an-object-id')}` }),
			{} as Response,
			next,
		);
		expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
	});

	it('Bearer inválido → 401 mesmo com API key válida', async () => {
		const next = vi.fn();
		await authenticate(
			req({ authorization: 'Bearer invalido', 'x-api-key': 'env-key' }),
			{} as Response,
			next,
		);
		expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
	});

	it('Bearer válido → req.userId + authMethod jwt', async () => {
		const next = vi.fn();
		const r = req({ authorization: `Bearer ${signAccessToken('507f1f77bcf86cd799439011')}` });
		await authenticate(r, {} as Response, next);
		expect(next).toHaveBeenCalledWith();
		expect((r as Request & { userId?: string }).userId).toBe('507f1f77bcf86cd799439011');
		expect((r as Request & { authMethod?: string }).authMethod).toBe('jwt');
	});

	it('Bearer válido + API key do mesmo usuário → aceita como jwt', async () => {
		keyUser('507f1f77bcf86cd799439011');
		const next = vi.fn();
		const r = req({ authorization: `Bearer ${signAccessToken('507f1f77bcf86cd799439011')}`, 'x-api-key': 'env-key' });
		await authenticate(r, {} as Response, next);
		expect(next).toHaveBeenCalledWith();
		expect((r as Request & { userId?: string }).userId).toBe('507f1f77bcf86cd799439011');
	});

	it('Bearer válido + API key de outro usuário → 401', async () => {
		keyUser('507f1f77bcf86cd799439022');
		const next = vi.fn();
		await authenticate(
			req({ authorization: `Bearer ${signAccessToken('507f1f77bcf86cd799439011')}`, 'x-api-key': 'env-key' }),
			{} as Response,
			next,
		);
		expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
	});

	it('Bearer válido + API key errada → 401', async () => {
		const next = vi.fn();
		await authenticate(
			req({ authorization: `Bearer ${signAccessToken('507f1f77bcf86cd799439011')}`, 'x-api-key': 'errada' }),
			{} as Response,
			next,
		);
		expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
	});
});
