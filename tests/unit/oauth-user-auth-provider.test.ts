import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/env.js', () => ({
	getEnv: vi.fn().mockReturnValue({
		GOOGLE_OAUTH_CLIENT_ID: 'test-client-id',
		GOOGLE_OAUTH_CLIENT_SECRET: 'test-client-secret',
		GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:3000/callback',
	}),
}));

vi.mock('googleapis', () => {
	const mockSetCredentials = vi.fn();
	return {
		google: {
			auth: {
				OAuth2: vi.fn().mockImplementation(() => ({
					setCredentials: mockSetCredentials,
				})),
			},
		},
	};
});

vi.mock('../../src/models/google-connection.model.js', () => ({
	GoogleConnectionModel: {
		findOne: vi.fn().mockReturnValue({
			lean: vi.fn().mockResolvedValue({
				userId: 'user-123',
				refreshToken: 'mock-refresh-token',
				email: 'user@gmail.com',
			}),
		}),
	},
}));

import { createOAuthUserProvider } from '../../src/integrations/google/oauth-user-auth-provider.js';
import { GoogleConnectionModel } from '../../src/models/google-connection.model.js';

describe('OAuthUserAuthProvider', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns a GoogleAuthProvider-compatible object', () => {
		const provider = createOAuthUserProvider('user-123');
		expect(provider).toBeDefined();
		expect(typeof provider.getClient).toBe('function');
	});

	it('creates OAuth2Client with refresh token from connection', async () => {
		const provider = createOAuthUserProvider('user-123');
		const client = await provider.getClient();
		expect(client).toBeDefined();
		expect(GoogleConnectionModel.findOne).toHaveBeenCalledWith({ userId: 'user-123' });
	});

	it('throws when no connection exists', async () => {
		vi.mocked(GoogleConnectionModel.findOne).mockReturnValueOnce({
			lean: vi.fn().mockResolvedValue(null),
		} as never);
		const provider = createOAuthUserProvider('user-no-connection');
		await expect(provider.getClient()).rejects.toThrow('No Google connection found');
	});
});
