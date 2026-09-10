import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from './theme.js';

function mockMatchMedia(dark: boolean) {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		configurable: true,
		value: vi.fn().mockImplementation(() => ({
			matches: dark,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})),
	});
}

function Probe() {
	const { theme, toggleTheme } = useTheme();
	return (
		<div>
			<span data-testid="theme">{theme}</span>
			<button type="button" onClick={toggleTheme}>
				toggle
			</button>
		</div>
	);
}

describe('ThemeProvider', () => {
	afterEach(() => {
		cleanup();
		window.localStorage.clear();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('defaults to the OS preference when nothing is stored', () => {
		mockMatchMedia(true);
		render(
			<ThemeProvider>
				<Probe />
			</ThemeProvider>,
		);
		expect(screen.getByTestId('theme').textContent).toBe('dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});

	it('prefers the stored value over the OS preference', () => {
		mockMatchMedia(true);
		window.localStorage.setItem('axis.theme', 'light');
		render(
			<ThemeProvider>
				<Probe />
			</ThemeProvider>,
		);
		expect(screen.getByTestId('theme').textContent).toBe('light');
		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});

	it('toggle flips the theme and persists it', () => {
		mockMatchMedia(false);
		render(
			<ThemeProvider>
				<Probe />
			</ThemeProvider>,
		);
		expect(screen.getByTestId('theme').textContent).toBe('light');

		fireEvent.click(screen.getByText('toggle'));
		expect(screen.getByTestId('theme').textContent).toBe('dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
		expect(window.localStorage.getItem('axis.theme')).toBe('dark');

		fireEvent.click(screen.getByText('toggle'));
		expect(screen.getByTestId('theme').textContent).toBe('light');
		expect(window.localStorage.getItem('axis.theme')).toBe('light');
	});
});
