import { getApiBaseUrl } from './env.js';

export type ApiErrorKind =
	| 'bad-request'
	| 'unauthorized'
	| 'forbidden'
	| 'not-found'
	| 'conflict'
	| 'rate-limited'
	| 'server'
	| 'network';

// Normalized HTTP error. Feature code consumes ApiError only — never raw
// fetch Response objects or backend internals.
export class ApiError extends Error {
	readonly status: number | null;
	readonly kind: ApiErrorKind;
	readonly data: unknown;

	constructor(status: number | null, message: string, data: unknown = undefined) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.data = data;
		this.kind = ApiError.kindOf(status);
	}

	private static kindOf(status: number | null): ApiErrorKind {
		switch (status) {
			case 400:
				return 'bad-request';
			case 401:
				return 'unauthorized';
			case 403:
				return 'forbidden';
			case 404:
				return 'not-found';
			case 409:
				return 'conflict';
			case 422:
				return 'bad-request';
			case 429:
				return 'rate-limited';
			case null:
				return 'network';
			default:
				return 'server';
		}
	}
}

export interface RequestOptions {
	method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
	body?: unknown;
	// Resolved per request so login/refresh rotation (Phase 6.8) plugs in here.
	getAccessToken?: () => string | null;
	signal?: AbortSignal;
	// Skips the automatic 401 → refresh → retry flow. Always true for the
	// /api/auth/* endpoints themselves (a login 401 is invalid credentials,
	// a refresh 401 is an unrestorable session — never a refresh case).
	skipAuthRefresh?: boolean;
}

// Session-owned hooks, configured once by the auth layer (see auth/session.ts
// for the single-flight refresh). Kept as injected callbacks — not a context
// import — so this low-level module never depends on React.
export interface AuthHooks {
	getAccessToken: () => string | null;
	refreshAccessToken: () => Promise<boolean>;
}

let authHooks: AuthHooks | null = null;

// Shared across concurrent requests: N simultaneous 401s trigger exactly one
// refresh (critical for single-use rotating refresh tokens, where parallel
// rotations would invalidate each other). Session-level sharing also exists
// in auth/session.ts; the layers compose harmlessly.
let sharedRefresh: Promise<boolean> | null = null;

export function configureAuthHooks(hooks: AuthHooks | null): void {
	authHooks = hooks;
	sharedRefresh = null;
}

async function runSharedRefresh(): Promise<boolean> {
	if (!authHooks) return false;
	if (!sharedRefresh) {
		sharedRefresh = authHooks
			.refreshAccessToken()
			.catch(() => false)
			.finally(() => {
				sharedRefresh = null;
			});
	}
	return sharedRefresh;
}

function isAuthPath(path: string): boolean {
	return path.startsWith('/api/auth/');
}

function extractMessage(payload: unknown, fallback: string): string {
	if (payload && typeof payload === 'object' && 'error' in payload) {
		const message = (payload as { error: unknown }).error;
		if (typeof message === 'string' && message.length > 0) return message;
	}
	return fallback;
}

// Single HTTP entry point for the whole panel. Components must not call
// fetch() directly; feature services call these helpers instead.
//
// 401 handling: on an Unauthorized response the client attempts exactly one
// single-flight refresh (shared across concurrent requests) and retries the
// original request once with the fresh token. Auth endpoints never recurse:
// they always skip this flow.
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const { method = 'GET', body, signal } = options;
	const getToken = options.getAccessToken ?? authHooks?.getAccessToken ?? null;
	const skipRefresh = options.skipAuthRefresh ?? isAuthPath(path);

	const response = await send(path, method, body, getToken?.() ?? null, signal);
	if (response.status === 204) {
		return undefined as T;
	}

	if (response.status === 401 && !skipRefresh && authHooks) {
		const restored = await runSharedRefresh();
		if (restored) {
			const retryGetToken = options.getAccessToken ?? authHooks.getAccessToken;
			const retry = await send(path, method, body, retryGetToken() ?? null, signal);
			if (retry.status === 204) {
				return undefined as T;
			}
			return readBody<T>(retry);
		}
	}

	return readBody<T>(response);
}

async function send(
	path: string,
	method: NonNullable<RequestOptions['method']>,
	body: unknown,
	token: string | null,
	signal: AbortSignal | undefined,
): Promise<Response> {
	try {
		return await fetch(`${getApiBaseUrl()}${path}`, {
			method,
			headers: {
				'Content-Type': 'application/json',
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal,
		});
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') throw err;
		throw new ApiError(null, 'Falha de rede ao contatar a API');
	}
}

async function readBody<T>(response: Response): Promise<T> {
	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		payload = undefined;
	}

	if (!response.ok) {
		throw new ApiError(response.status, extractMessage(payload, `Erro ${response.status}`), payload);
	}
	return payload as T;
}

export function apiGet<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
	return apiRequest<T>(path, { ...options, method: 'GET' });
}
