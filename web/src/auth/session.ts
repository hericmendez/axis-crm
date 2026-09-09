import type { AuthResponse, AuthUser } from '../types/api.js';
import {
	clearTokens,
	getAccessToken,
	getRefreshToken,
	setAccessToken,
	setRefreshToken,
} from '../lib/auth-storage.js';
import { apiRequest } from '../lib/api-client.js';

// Single owner of session state. AuthProvider mirrors this into React;
// api-client calls refreshSession() through its hooks — never the reverse,
// so there is no api-client <-> context import cycle.
//
// Backend contract (authoritative): login returns a token pair; refresh is
// single-use rotation (old token dies, new pair issued); logout revokes.
let user: AuthUser | null = null;
let generation = 0;
let refreshPromise: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
	for (const listener of listeners) listener();
}

export function subscribeSession(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function getSessionUser(): AuthUser | null {
	return user;
}

function applySession(nextUser: AuthUser, accessToken: string, refreshToken: string): void {
	setAccessToken(accessToken);
	setRefreshToken(refreshToken);
	user = nextUser;
	notify();
}

function dropSession(): void {
	clearTokens();
	if (user !== null) {
		user = null;
		notify();
	}
}

export async function loginUser(email: string, password: string): Promise<AuthUser> {
	// skipAuthRefresh: a login 401 means invalid credentials, never a refresh case.
	const res = await apiRequest<AuthResponse>('/api/auth/login', {
		method: 'POST',
		body: { email, password },
		skipAuthRefresh: true,
	});
	applySession(res.user, res.accessToken, res.refreshToken);
	return res.user;
}

export async function logoutUser(): Promise<void> {
	// Bump first: a refresh resolving after this point must not resurrect us.
	generation += 1;
	const stored = getRefreshToken();
	dropSession();
	if (stored) {
		try {
			await apiRequest('/api/auth/logout', {
				method: 'POST',
				body: { refreshToken: stored },
				skipAuthRefresh: true,
			});
		} catch {
			// Best effort: local session is already gone either way.
		}
	}
}

// Single-flight refresh shared by boot restore, 401 retries and explicit calls.
// Resolves true only when fresh tokens were applied to the current generation.
export async function refreshSession(): Promise<boolean> {
	if (refreshPromise) return refreshPromise;
	const gen = generation;
	refreshPromise = (async () => {
		const stored = getRefreshToken();
		if (!stored) return false;
		try {
			const res = await apiRequest<AuthResponse>('/api/auth/refresh', {
				method: 'POST',
				body: { refreshToken: stored },
				skipAuthRefresh: true,
			});
			if (gen !== generation) {
				// Logged out while refreshing: revoke what we just got, apply nothing.
				try {
					await apiRequest('/api/auth/logout', {
						method: 'POST',
						body: { refreshToken: res.refreshToken },
						skipAuthRefresh: true,
					});
				} catch {
					// best effort
				}
				return false;
			}
			applySession(res.user, res.accessToken, res.refreshToken);
			return true;
		} catch {
			// Refresh 401 (expired/revoked) or network failure on the same
			// generation: the session is unusable — drop it.
			if (gen === generation) dropSession();
			return false;
		}
	})();
	try {
		return await refreshPromise;
	} finally {
		refreshPromise = null;
	}
}

export async function restoreSession(): Promise<boolean> {
	if (!getRefreshToken()) return false;
	return refreshSession();
}

export function getSessionAccessToken(): string | null {
	return getAccessToken();
}
