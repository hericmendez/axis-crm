import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { App } from '../App.js';
import { AuthProvider, useAuth } from '../auth/AuthContext.js';
import { logoutUser } from '../auth/session.js';
import { AppShell } from './shell.js';

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function Probe() {
	const auth = useAuth();
	return (
		<div>
			<span data-testid="status">{auth.isAuthenticated ? 'in' : 'out'}</span>
			<span data-testid="token">{auth.tokenHook() ?? 'none'}</span>
			<button
				type="button"
				onClick={() => auth.setSession({ id: '1', email: 'a@x.com', name: 'A' }, 'access')}
			>
				login
			</button>
			<button type="button" onClick={() => auth.clearSession()}>
				logout
			</button>
		</div>
	);
}

describe('App shell and routing foundation', () => {
	afterEach(async () => {
		await logoutUser();
		cleanup();
		window.localStorage.clear();
	});

	it('renders and redirects unauthenticated users to the login page', async () => {
		render(<App />);
		expect(screen.getByText('Axis CRM')).toBeTruthy();
		// Boot shows the loading boundary first, then lands on login.
		expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeTruthy();
	});

	it('auth state starts unauthenticated and round-trips a session', () => {
		render(
			<AuthProvider>
				<Probe />
			</AuthProvider>,
		);
		expect(screen.getByTestId('status').textContent).toBe('out');
		expect(screen.getByTestId('token').textContent).toBe('none');

		fireEvent.click(screen.getByText('login'));
		expect(screen.getByTestId('status').textContent).toBe('in');
		expect(screen.getByTestId('token').textContent).toBe('access');

		fireEvent.click(screen.getByText('logout'));
		expect(screen.getByTestId('status').textContent).toBe('out');
		expect(screen.getByTestId('token').textContent).toBe('none');
	});

	it('authenticated shell shows nav, user info, active route and logout', async () => {
		window.localStorage.setItem('axis.refreshToken', 'refresh-boot');
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => {
				return Promise.resolve(
					jsonResponse(200, {
						accessToken: 'access-boot',
						refreshToken: 'refresh-boot-2',
						user: { id: '1', email: 'a@x.com', name: 'A' },
					}),
				);
			}),
		);

		const router = createMemoryRouter(
			[
				{
					element: <AppShell />,
					children: [{ path: '/leads', element: <div>leads-stub</div> }],
				},
			],
			{ initialEntries: ['/leads'] },
		);
		render(
			<AuthProvider>
				<RouterProvider router={router} />
			</AuthProvider>,
		);

		expect(await screen.findByText('leads-stub')).toBeTruthy();
		for (const label of ['Dashboard', 'Leads', 'Agenda', 'Conversas', 'Integrações']) {
			expect(screen.getByRole('link', { name: label })).toBeTruthy();
		}
		expect(screen.getByRole('link', { name: 'Leads' }).className).toMatch(/active/);
		expect(screen.getByText(/A \(a@x\.com\)/)).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: /sair/i }));
		await waitFor(() => expect(screen.queryByText(/A \(a@x\.com\)/)).toBeNull());
	});
});
