import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser } from '../types/api.js';
import { getAccessToken, setAccessToken, clearTokens } from '../lib/auth-storage.js';
import { configureAuthHooks } from '../lib/api-client.js';
import {
	getSessionUser,
	loginUser,
	logoutUser,
	refreshSession,
	restoreSession,
	subscribeSession,
} from './session.js';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
	status: AuthStatus;
	user: AuthUser | null;
	isAuthenticated: boolean;
	tokenHook: () => string | null;
	setSession: (user: AuthUser, accessToken: string) => void;
	clearSession: () => void;
	login: (email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Central session state. Bootstraps once: while the persisted refresh token
// is being validated the status stays 'loading' so guards never flash
// protected content. The api-client hooks are wired here exactly once.
export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [booted, setBooted] = useState(false);
	const status: AuthStatus = !booted ? 'loading' : user ? 'authenticated' : 'unauthenticated';

	useEffect(() => {
		configureAuthHooks({
			getAccessToken,
			refreshAccessToken: () => refreshSession(),
		});
		let cancelled = false;
		restoreSession()
			.then(() => {
				if (cancelled) return;
				setUser(getSessionUser());
				setBooted(true);
			})
			.catch(() => {
				if (cancelled) return;
				setUser(null);
				setBooted(true);
			});
		return () => {
			cancelled = true;
			configureAuthHooks(null);
		};
	}, []);

	useEffect(() => subscribeSession(() => setUser(getSessionUser())), []);

	const setSession = useCallback((nextUser: AuthUser, token: string) => {
		setAccessToken(token);
		setUser(nextUser);
	}, []);

	const clearSession = useCallback(() => {
		clearTokens();
		setUser(null);
	}, []);

	const login = useCallback(async (email: string, password: string) => {
		const nextUser = await loginUser(email, password);
		setUser(nextUser);
	}, []);

	const logout = useCallback(async () => {
		await logoutUser();
		setUser(null);
	}, []);

	const value = useMemo<AuthState>(
		() => ({
			status,
			user,
			isAuthenticated: user !== null,
			tokenHook: getAccessToken,
			setSession,
			clearSession,
			login,
			logout,
		}),
		[user, status, setSession, clearSession, login, logout],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
	const state = useContext(AuthContext);
	if (!state) throw new Error('useAuth must be used inside <AuthProvider>');
	return state;
}
