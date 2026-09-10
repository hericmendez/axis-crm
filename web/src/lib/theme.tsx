import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'axis.theme';

function systemTheme(): Theme {
	if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}
	return 'light';
}

function storedTheme(): Theme | null {
	try {
		const value = window.localStorage.getItem(STORAGE_KEY);
		return value === 'light' || value === 'dark' ? value : null;
	} catch {
		return null;
	}
}

function applyTheme(theme: Theme) {
	document.documentElement.classList.toggle('dark', theme === 'dark');
}

interface ThemeState {
	theme: Theme;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

// Explicit preference wins; otherwise the OS preference applies on first
// visit. The inline script in index.html pre-applies the same value before
// first paint to avoid a theme flash.
export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme());

	useEffect(() => {
		applyTheme(theme);
		try {
			window.localStorage.setItem(STORAGE_KEY, theme);
		} catch {
			// Storage unavailable: theme simply won't persist.
		}
	}, [theme]);

	const toggleTheme = useCallback(() => {
		setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
	}, []);

	const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
	const state = useContext(ThemeContext);
	if (!state) throw new Error('useTheme must be used inside <ThemeProvider>');
	return state;
}
