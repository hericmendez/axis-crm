import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiRequest, configureAuthHooks } from './api-client.js';

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

describe('apiRequest', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		configureAuthHooks(null);
	});

	it('prefixes the configured base URL and sends JSON', async () => {
		const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, { ok: true })));
		vi.stubGlobal('fetch', fetchMock);

		const result = await apiRequest<{ ok: boolean }>('/api/leads', {
			method: 'POST',
			body: { nome: 'João' },
		});

		expect(result).toEqual({ ok: true });
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('/api/leads');
		expect(init.method).toBe('POST');
		expect(init.body).toBe(JSON.stringify({ nome: 'João' }));
		expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
	});

	it('attaches the bearer token from the hook', async () => {
		const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
		vi.stubGlobal('fetch', fetchMock);

		await apiGet('/api/leads', { getAccessToken: () => 'tok-123' });
		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok-123');
	});

	it('omits Authorization without a token', async () => {
		const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
		vi.stubGlobal('fetch', fetchMock);

		await apiGet('/api/leads');
		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
	});

	it('resolves 204 with undefined', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 204 }))));
		await expect(apiRequest('/api/leads/1', { method: 'DELETE' })).resolves.toBeUndefined();
	});

	it.each([
		[400, 'bad-request'],
		[401, 'unauthorized'],
		[403, 'forbidden'],
		[404, 'not-found'],
		[409, 'conflict'],
		[422, 'bad-request'],
		[429, 'rate-limited'],
		[500, 'server'],
	] as Array<[number, string]>)('normalizes status %i to kind %s', async (status, kind) => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(status, { error: 'ops' }))));
		const err = await apiGet('/x').catch((e: unknown) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect((err as ApiError).status).toBe(status);
		expect((err as ApiError).kind).toBe(kind);
		expect((err as ApiError).message).toBe('ops');
	});

	it('falls back when the error body is not JSON', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => Promise.resolve(new Response('<html></html>', { status: 500 }))),
		);
		const err = await apiGet('/x').catch((e: unknown) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect((err as ApiError).message).toBe('Erro 500');
	});

	it('maps network failure to the network kind', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
		const err = await apiGet('/x').catch((e: unknown) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect((err as ApiError).status).toBeNull();
		expect((err as ApiError).kind).toBe('network');
	});
});

describe('apiRequest 401 refresh flow', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		configureAuthHooks(null);
	});

	function authHeadersOf(call: unknown): Record<string, string> {
		return (call as [string, RequestInit])[1].headers as Record<string, string>;
	}

	it('injects the bearer token from configured hooks', async () => {
		const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
		vi.stubGlobal('fetch', fetchMock);
		configureAuthHooks({ getAccessToken: () => 'tok-1', refreshAccessToken: vi.fn() });

		await apiGet('/api/leads');
		expect(authHeadersOf(fetchMock.mock.calls[0])['Authorization']).toBe('Bearer tok-1');
	});

	it('401 triggers one refresh and retries with the new token', async () => {
		let current = 'old-token';
		const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
			if (url === '/api/leads') {
				const auth = (fetchMock.mock.calls.at(-1)?.[1] as RequestInit)?.headers as Record<
					string,
					string
				>;
				return auth['Authorization'] === 'Bearer new-token'
					? jsonResponse(200, { ok: true })
					: jsonResponse(401, { error: 'x' });
			}
			return jsonResponse(200, {});
		});
		vi.stubGlobal('fetch', fetchMock);
		configureAuthHooks({
			getAccessToken: () => current,
			refreshAccessToken: vi.fn().mockImplementation(async () => {
				current = 'new-token';
				return true;
			}),
		});

		const result = await apiGet<{ ok: boolean }>('/api/leads');
		expect(result).toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('concurrent 401s share a single refresh and all retry', async () => {
		const refresh = vi.fn().mockImplementation(async () => true);
		const calls: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				calls.push(url);
				if (url === '/api/auth/refresh') return jsonResponse(200, {});
				if (calls.filter((u) => u === '/api/leads').length <= 3) {
					return jsonResponse(401, { error: 'x' });
				}
				return jsonResponse(200, { ok: true });
			}),
		);
		configureAuthHooks({ getAccessToken: () => 't', refreshAccessToken: refresh });

		const results = await Promise.all([apiGet('/api/leads'), apiGet('/api/leads'), apiGet('/api/leads')]);
		expect(results).toHaveLength(3);
		// 3 initials + 3 retries, and exactly one shared refresh call.
		expect(calls.filter((u) => u === '/api/leads')).toHaveLength(6);
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('failed refresh surfaces the original 401 without retrying', async () => {
		const fetchMock = vi.fn(async () => jsonResponse(401, { error: 'expired' }));
		vi.stubGlobal('fetch', fetchMock);
		configureAuthHooks({ getAccessToken: () => 't', refreshAccessToken: vi.fn().mockImplementation(async () => false) });

		const err = await apiGet('/api/leads').catch((e: unknown) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect((err as ApiError).status).toBe(401);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('auth endpoints never trigger refresh (no recursion)', async () => {
		const refresh = vi.fn();
		const fetchMock = vi.fn(async () => jsonResponse(401, { error: 'Credenciais inválidas' }));
		vi.stubGlobal('fetch', fetchMock);
		configureAuthHooks({ getAccessToken: () => 't', refreshAccessToken: refresh });

		for (const path of ['/api/auth/login', '/api/auth/refresh', '/api/auth/logout']) {
			await expect(
				apiRequest(path, { method: 'POST', body: {} }).catch((e: unknown) => e),
			).resolves.toBeInstanceOf(ApiError);
		}
		expect(refresh).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('skipAuthRefresh option is honored on arbitrary paths', async () => {
		const refresh = vi.fn();
		const fetchMock = vi.fn(async () => jsonResponse(401, { error: 'x' }));
		vi.stubGlobal('fetch', fetchMock);
		configureAuthHooks({ getAccessToken: () => 't', refreshAccessToken: refresh });

		await expect(
			apiGet('/api/leads', { skipAuthRefresh: true }).catch((e: unknown) => e),
		).resolves.toBeInstanceOf(ApiError);
		expect(refresh).not.toHaveBeenCalled();
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
