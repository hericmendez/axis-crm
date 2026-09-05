import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../src/models/user.model.js', () => ({
	UserModel: {
		findOne: vi.fn().mockReturnValue({
			select: vi.fn().mockReturnValue({
				lean: vi.fn().mockResolvedValue({ _id: 'existing-user-id' }),
			}),
		}),
		create: vi.fn().mockResolvedValue({ _id: 'new-user-id' }),
	},
}));

import { resolveUser } from '../../src/middlewares/resolve-user.middleware.js';
import { UserModel } from '../../src/models/user.model.js';

describe('resolveUser middleware', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	function createReq(apiKey?: string) {
		return {
			header: (name: string) => (name === 'x-api-key' ? apiKey : undefined),
		} as unknown as Request;
	}

	function createRes() {
		return {} as Response;
	}

	it('skips when no API key is present', async () => {
		const next = vi.fn();
		await resolveUser(createReq(), createRes(), next);
		expect(next).toHaveBeenCalled();
		expect(UserModel.findOne).not.toHaveBeenCalled();
	});

	it('resolves existing user by API key', async () => {
		const next = vi.fn();
		const req = createReq('valid-api-key');
		await resolveUser(req, createRes(), next);
		expect(next).toHaveBeenCalled();
		expect((req as Request & { userId: string }).userId).toBe('existing-user-id');
	});

	it('creates default user when API key has no matching user', async () => {
		vi.mocked(UserModel.findOne).mockReturnValueOnce({
			select: vi.fn().mockReturnValue({
				lean: vi.fn().mockResolvedValue(null),
			}),
		} as never);

		const next = vi.fn();
		const req = createReq('new-api-key');
		await resolveUser(req, createRes(), next);
		expect(UserModel.create).toHaveBeenCalledWith({ name: 'Axis User', apiKey: 'new-api-key' });
		expect((req as Request & { userId: string }).userId).toBe('new-user-id');
	});
});
