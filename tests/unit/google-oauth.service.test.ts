import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/env.js', () => ({
	getEnv: vi.fn().mockReturnValue({
		GOOGLE_OAUTH_CLIENT_ID: 'test-client-id',
		GOOGLE_OAUTH_CLIENT_SECRET: 'test-client-secret',
		GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:3000/api/v1/integrations/google/callback',
	}),
}));

vi.mock('googleapis', () => {
	const mockGenerateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?mock=true');
	const mockGetToken = vi.fn().mockResolvedValue({
		tokens: { refresh_token: 'mock-refresh-token', access_token: 'mock-access-token' },
	});
	const mockSetCredentials = vi.fn();
	const mockRequest = vi.fn().mockResolvedValue({
		data: { id: 'google-sub-123', email: 'user@gmail.com' },
	});
	return {
		google: {
			auth: {
				OAuth2: vi.fn().mockImplementation(() => ({
					generateAuthUrl: mockGenerateAuthUrl,
					getToken: mockGetToken,
					setCredentials: mockSetCredentials,
					request: mockRequest,
				})),
			},
		},
	};
});

vi.mock('../../src/models/oauth-state.model.js', () => ({
	OAuthStateModel: {
		create: vi.fn().mockResolvedValue({}),
		findOneAndDelete: vi.fn().mockReturnValue({
			lean: vi.fn().mockResolvedValue({
				state: 'valid-state',
				userId: 'user-id-123',
				expiresAt: new Date(Date.now() + 60000),
			}),
		}),
	},
}));

vi.mock('../../src/integrations/google/provisioner.js', () => ({
	provision: vi.fn().mockResolvedValue({ calendarId: 'cal-123', spreadsheetId: 'sheet-123' }),
}));

vi.mock('../../src/models/google-connection.model.js', () => ({
	GoogleConnectionModel: {
		findOneAndUpdate: vi.fn().mockResolvedValue({}),
		findOneAndDelete: vi.fn().mockResolvedValue({}),
		findOne: vi.fn().mockReturnValue({
			lean: vi.fn().mockResolvedValue(null),
		}),
	},
}));

import { generateAuthorizationUrl, handleCallback, disconnectUser, getConnection } from '../../src/integrations/google/oauth.service.js';
import { OAuthStateModel } from '../../src/models/oauth-state.model.js';
import { GoogleConnectionModel } from '../../src/models/google-connection.model.js';
import { provision } from '../../src/integrations/google/provisioner.js';

describe('GoogleOAuthService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('generateAuthorizationUrl', () => {
		it('generates a URL with correct parameters', async () => {
			const url = await generateAuthorizationUrl('user-123');
			expect(url).toContain('https://accounts.google.com/o/oauth2/auth');
			expect(OAuthStateModel.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: 'user-123',
				}),
			);
		});

		it('creates a state entry in MongoDB', async () => {
			await generateAuthorizationUrl('user-456');
			expect(OAuthStateModel.create).toHaveBeenCalledTimes(1);
			const call = vi.mocked(OAuthStateModel.create).mock.calls[0][0] as Record<string, unknown>;
			expect(call.state).toBeDefined();
			expect(typeof call.state).toBe('string');
			expect((call.state as string).length).toBe(64);
		});

		it('awaits OAuthStateModel.create before returning URL', async () => {
			const createOrder: string[] = [];
			vi.mocked(OAuthStateModel.create).mockImplementationOnce(async () => {
				createOrder.push('create');
				return {} as never;
			});

			const mockGenerateAuthUrl = vi.fn().mockImplementation(() => {
				createOrder.push('generateAuthUrl');
				return 'https://accounts.google.com/o/oauth2/auth?mock=true';
			});

			const { google } = await import('googleapis');
			vi.mocked(google.auth.OAuth2).mockImplementationOnce(() => ({
				generateAuthUrl: mockGenerateAuthUrl,
				getToken: vi.fn(),
				setCredentials: vi.fn(),
			} as never));

			await generateAuthorizationUrl('user-789');
			expect(createOrder).toEqual(['create', 'generateAuthUrl']);
		});

		it('rejects when OAuthStateModel.create fails', async () => {
			vi.mocked(OAuthStateModel.create).mockRejectedValueOnce(new Error('DB write failed'));
			await expect(generateAuthorizationUrl('user-err')).rejects.toThrow('DB write failed');
		});
	});

	describe('handleCallback', () => {
		it('exchanges code and persists connection', async () => {
			const result = await handleCallback('auth-code-123', 'valid-state');
			expect(result.email).toBe('user@gmail.com');
			expect(result.userId).toBe('user-id-123');
			expect(GoogleConnectionModel.findOneAndUpdate).toHaveBeenCalledWith(
				{ userId: 'user-id-123' },
				expect.objectContaining({
					googleSubject: 'google-sub-123',
					email: 'user@gmail.com',
					refreshToken: 'mock-refresh-token',
					scopes: expect.arrayContaining([
						'https://www.googleapis.com/auth/calendar.app.created',
						'https://www.googleapis.com/auth/userinfo.email',
					]),
				}),
				{ upsert: true, new: true },
			);
		});

		it('throws on invalid state', async () => {
			vi.mocked(OAuthStateModel.findOneAndDelete).mockReturnValueOnce({
				lean: vi.fn().mockResolvedValue(null),
			} as never);
			await expect(handleCallback('auth-code', 'bad-state')).rejects.toThrow('Invalid or expired OAuth state');
		});

		it('consumes state (single-use)', async () => {
			await handleCallback('auth-code', 'valid-state');
			expect(OAuthStateModel.findOneAndDelete).toHaveBeenCalledWith({ state: 'valid-state' });
		});

		it('calls provision after persisting connection', async () => {
			await handleCallback('auth-code', 'valid-state');
			expect(provision).toHaveBeenCalledWith('user-id-123');
		});

		it('passes correct userId to provision', async () => {
			await handleCallback('auth-code', 'valid-state');
			expect(provision).toHaveBeenCalledTimes(1);
			const call = vi.mocked(provision).mock.calls[0];
			expect(call[0]).toBe('user-id-123');
		});

		it('succeeds even when provision fails', async () => {
			vi.mocked(provision).mockRejectedValueOnce(new Error('Provisioning API error'));
			const result = await handleCallback('auth-code', 'valid-state');
			expect(result.email).toBe('user@gmail.com');
			expect(result.userId).toBe('user-id-123');
			expect(GoogleConnectionModel.findOneAndUpdate).toHaveBeenCalled();
		});
	});

	describe('disconnectUser', () => {
		it('deletes the connection', async () => {
			await disconnectUser('user-123');
			expect(GoogleConnectionModel.findOneAndDelete).toHaveBeenCalledWith({ userId: 'user-123' });
		});
	});

	describe('getConnection', () => {
		it('returns null when no connection exists', async () => {
			const result = await getConnection('user-123');
			expect(result).toBeNull();
		});
	});
});
