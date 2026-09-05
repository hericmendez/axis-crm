import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createServiceAccountProvider, getGoogleAuth, clearAuthCache } from '../../src/integrations/google/auth.js';
import type { GoogleAuthProvider } from '../../src/integrations/google/auth.js';

vi.mock('googleapis', () => {
	const mockFromJSON = vi.fn().mockImplementation(() => ({
		setAccessToken: vi.fn(),
		authorize: vi.fn(),
		_clientEmail: `client-${Date.now()}-${Math.random()}`,
	}));
	return {
		google: {
			auth: {
				GoogleAuth: vi.fn().mockImplementation(() => ({
					fromJSON: mockFromJSON,
				})),
			},
		},
	};
});

describe('Google Auth', () => {
	beforeEach(() => {
		clearAuthCache();
	});

	it('creates auth client with valid config', () => {
		const client = getGoogleAuth({
			clientEmail: 'test@sa.iam.gserviceaccount.com',
			privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----',
		});
		expect(client).toBeDefined();
	});

	it('caches the auth client across calls', () => {
		const client1 = getGoogleAuth({
			clientEmail: 'test@sa.iam.gserviceaccount.com',
			privateKey: 'key',
		});
		const client2 = getGoogleAuth({
			clientEmail: 'test@sa.iam.gserviceaccount.com',
			privateKey: 'key',
		});
		expect(client1).toBe(client2);
	});

	it('creates new client after cache clear', () => {
		const client1 = getGoogleAuth({
			clientEmail: 'test@sa.iam.gserviceaccount.com',
			privateKey: 'key',
		});
		clearAuthCache();
		const client2 = getGoogleAuth({
			clientEmail: 'test@sa.iam.gserviceaccount.com',
			privateKey: 'key',
		});
		expect(client1).not.toBe(client2);
	});
});

describe('GoogleAuthProvider interface', () => {
	beforeEach(() => {
		clearAuthCache();
	});

	it('createServiceAccountProvider returns a GoogleAuthProvider', () => {
		const provider = createServiceAccountProvider({
			clientEmail: 'test@sa.iam.gserviceaccount.com',
			privateKey: 'key',
		});
		const _check: GoogleAuthProvider = provider;
		expect(_check).toBeDefined();
	});

	it('provider.getClient() returns an auth client', async () => {
		const provider = createServiceAccountProvider({
			clientEmail: 'test@sa.iam.gserviceaccount.com',
			privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----',
		});
		const client = await provider.getClient();
		expect(client).toBeDefined();
	});

	it('provider.getClient() returns cached client across calls', async () => {
		const provider = createServiceAccountProvider({
			clientEmail: 'test@sa.iam.gserviceaccount.com',
			privateKey: 'key',
		});
		const client1 = await provider.getClient();
		const client2 = await provider.getClient();
		expect(client1).toBe(client2);
	});

	it('provider.getClient() returns new client after cache clear', async () => {
		const provider = createServiceAccountProvider({
			clientEmail: 'test@sa.iam.gserviceaccount.com',
			privateKey: 'key',
		});
		const client1 = await provider.getClient();
		clearAuthCache();
		const client2 = await provider.getClient();
		expect(client1).not.toBe(client2);
	});
});
