// Token storage decision (see web/docs/ARCHITECTURE.md):
// - access JWT lives only in memory (React context) — never persisted;
// - refresh token lives in localStorage — it is single-use and rotated by the
//   backend on every refresh, which bounds the blast radius if read via XSS.
// No backend contract change was needed: login/refresh/logout already work
// with bearer + opaque token in the JSON body.
const REFRESH_KEY = 'axis.refreshToken';

let accessToken: string | null = null;

export function getAccessToken(): string | null {
	return accessToken;
}

export function setAccessToken(token: string | null): void {
	accessToken = token;
}

export function getRefreshToken(): string | null {
	try {
		return window.localStorage.getItem(REFRESH_KEY);
	} catch {
		return null;
	}
}

export function setRefreshToken(token: string | null): void {
	try {
		if (token === null) {
			window.localStorage.removeItem(REFRESH_KEY);
		} else {
			window.localStorage.setItem(REFRESH_KEY, token);
		}
	} catch {
		// Storage unavailable (private mode, etc.): session simply won't persist.
	}
}

export function clearTokens(): void {
	accessToken = null;
	setRefreshToken(null);
}
