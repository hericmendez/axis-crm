import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	getSessionAccessToken,
	getSessionUser,
	loginUser,
	logoutUser,
	refreshSession,
	restoreSession,
} from './session.js';
import { getAccessToken, getRefreshToken } from '../lib/auth-storage.js';
import { ApiError } from '../lib/api-client.js';

const USER = { id: '507f1f77bcf86cd799439011', email: 'ops@example.com', name: 'Ops' };

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function pair(tag: string) {
	return {
		accessToken: `access-${tag}`,
		refreshToken: `refresh-${tag}`,
		user: USER,
	};
}

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init: RequestInit) => {
			calls.push({ url, init });
			return handler(url, init);
		}),
	);
	return calls;
}

function bodies(calls: Array<{ url: string; init: RequestInit }>, url: string): unknown[] {
	return calls.filter((c) => c.url === url).map((c) => JSON.parse(String(c.init.body)));
}

describe('session lifecycle', () => {
	afterEach(async () => {
		// Reset module-owned session state (user/generation/pending refresh).
		await logoutUser();
		vi.unstubAllGlobals();
		window.localStorage.clear();
	});

	it('login stores tokens and user without exposing secrets', async () => {
		const calls = mockFetch(() => jsonResponse(200, pair('a')));

		const user = await loginUser('ops@example.com', 's3nha-f0rte');
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe('/api/auth/login');
		expect(user).toEqual(USER);
		expect(getSessionAccessToken()).toBe('access-a');
		expect(getAccessToken()).toBe('access-a');
		expect(getRefreshToken()).toBe('refresh-a');
		expect(getSessionUser()).toEqual(USER);
	});

	it('login 401 propagates and persists nothing', async () => {
		mockFetch(() => jsonResponse(401, { error: 'Credenciais inválidas' }));
		await expect(loginUser('ops@example.com', 'errada')).rejects.toBeInstanceOf(ApiError);
		expect(getAccessToken()).toBeNull();
		expect(getRefreshToken()).toBeNull();
		expect(getSessionUser()).toBeNull();
	});

	it('restore with valid stored token re-authenticates and persists rotation', async () => {
		window.localStorage.setItem('axis.refreshToken', 'refresh-old');
		const calls = mockFetch(() => jsonResponse(200, pair('b')));

		await expect(restoreSession()).resolves.toBe(true);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe('/api/auth/refresh');
		expect(getSessionAccessToken()).toBe('access-b');
		expect(getRefreshToken()).toBe('refresh-b');
		expect(getSessionUser()).toEqual(USER);
	});

	it('restore without stored token performs no request', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		await expect(restoreSession()).resolves.toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('restore with rejected refresh clears everything', async () => {
		window.localStorage.setItem('axis.refreshToken', 'refresh-stale');
		mockFetch(() => jsonResponse(401, { error: 'Refresh token inválido ou expirado' }));

		await expect(restoreSession()).resolves.toBe(false);
		expect(getAccessToken()).toBeNull();
		expect(getRefreshToken()).toBeNull();
		expect(getSessionUser()).toBeNull();
	});

	it('concurrent refreshes share a single backend call', async () => {
		window.localStorage.setItem('axis.refreshToken', 'refresh-old');
		const calls = mockFetch(() => jsonResponse(200, pair('c')));

		const [a, b, c] = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
		expect([a, b, c]).toEqual([true, true, true]);
		expect(calls.filter((call) => call.url === '/api/auth/refresh')).toHaveLength(1);
		expect(getRefreshToken()).toBe('refresh-c');
	});

	it('logout revokes on the server and always clears locally', async () => {
		window.localStorage.setItem('axis.refreshToken', 'refresh-old');
		const calls = mockFetch(() => jsonResponse(200, pair('d')));
		await loginUser('ops@example.com', 's3nha-f0rte');

		await logoutUser();
		expect(getAccessToken()).toBeNull();
		expect(getRefreshToken()).toBeNull();
		expect(getSessionUser()).toBeNull();
		expect(bodies(calls, '/api/auth/logout')).toEqual([{ refreshToken: 'refresh-d' }]);
	});

	it('logout clears locally even when the backend call fails', async () => {
		window.localStorage.setItem('axis.refreshToken', 'refresh-old');
		mockFetch((url: string) => {
			if (url === '/api/auth/logout') throw new TypeError('offline');
			return jsonResponse(200, pair('e'));
		});
		await loginUser('ops@example.com', 's3nha-f0rte');

		await expect(logoutUser()).resolves.toBeUndefined();
		expect(getAccessToken()).toBeNull();
		expect(getRefreshToken()).toBeNull();
	});

	it('logout during refresh never resurrects the session', async () => {
		window.localStorage.setItem('axis.refreshToken', 'refresh-old');
		let releaseRefresh!: (value: Response) => void;
		const gate = new Promise<Response>((resolve) => {
			releaseRefresh = resolve;
		});
		const calls = mockFetch((url: string) => {
			if (url === '/api/auth/refresh') return gate;
			return jsonResponse(200, { ok: true });
		});

		const pending = refreshSession();
		await logoutUser();
		releaseRefresh(jsonResponse(200, pair('new')));

		await expect(pending).resolves.toBe(false);
		expect(getAccessToken()).toBeNull();
		expect(getRefreshToken()).toBeNull();
		expect(getSessionUser()).toBeNull();
		// The just-issued pair was revoked best-effort instead of applied.
		expect(bodies(calls, '/api/auth/logout')).toContainEqual({ refreshToken: 'refresh-new' });
	});
});
