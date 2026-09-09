import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext.js';
import { logoutUser } from '../auth/session.js';
import { LoginPage } from './LoginPage.js';
import { ProtectedRoute, PublicOnlyRoute } from '../app/guards.js';

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

const USER = { id: '507f1f77bcf86cd799439011', email: 'ops@example.com', name: 'Ops' };

function renderLogin(initialPath = '/login') {
	const router = createMemoryRouter(
		[
			{ element: <PublicOnlyRoute />, children: [{ path: '/login', element: <LoginPage /> }] },
			{
				element: <ProtectedRoute />,
				children: [{ path: '/', element: <div>protected-home</div> }],
			},
		],
		{ initialEntries: [initialPath] },
	);
	render(
		<AuthProvider>
			<RouterProvider router={router} />
		</AuthProvider>,
	);
	return router;
}

describe('LoginPage', () => {
	afterEach(async () => {
		await logoutUser();
		cleanup();
		vi.unstubAllGlobals();
		window.localStorage.clear();
	});

	it('renders labeled email/password fields and submit', async () => {
		renderLogin();
		expect(await screen.findByLabelText(/email/i)).toBeTruthy();
		expect(screen.getByLabelText(/senha/i)).toBeTruthy();
		expect(screen.getByRole('button', { name: /entrar/i })).toBeTruthy();
	});

	it('validates email format client-side without calling the API', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		renderLogin();

		fireEvent.change(await screen.findByLabelText(/email/i), { target: { value: 'not-an-email' } });
		fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 'x' } });
		fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

		expect(await screen.findByText(/email válido/i)).toBeTruthy();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('successful login navigates to the protected area', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => 
				jsonResponse(200, { accessToken: 'a1', refreshToken: 'r1', user: USER }),
			),
		);
		renderLogin();

		fireEvent.change(await screen.findByLabelText(/email/i), { target: { value: 'ops@example.com' } });
		fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 's3nha-f0rte' } });
		fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

		expect(await screen.findByText('protected-home')).toBeTruthy();
		expect(window.localStorage.getItem('axis.refreshToken')).toBe('r1');
	});

	it('invalid credentials show the generic message and clear the password', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(401, { error: 'x' }))));
		renderLogin();

		fireEvent.change(await screen.findByLabelText(/email/i), { target: { value: 'ops@example.com' } });
		const password = screen.getByLabelText(/senha/i) as HTMLInputElement;
		fireEvent.change(password, { target: { value: 'errada' } });
		fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

		expect(await screen.findByText('Credenciais inválidas.')).toBeTruthy();
		expect(password.value).toBe('');
		expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe('ops@example.com');
	});

	it('double submit issues a single request and disables the button', async () => {
		let resolveLogin!: (value: Response) => void;
		const gate = new Promise<Response>((resolve) => {
			resolveLogin = resolve;
		});
		const fetchMock = vi.fn().mockReturnValue(gate);
		vi.stubGlobal('fetch', fetchMock);
		renderLogin();

		fireEvent.change(await screen.findByLabelText(/email/i), { target: { value: 'ops@example.com' } });
		fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 's3nha-f0rte' } });
		const button = await screen.findByRole('button', { name: /entrar/i });
		fireEvent.click(button);
		fireEvent.click(button);

		expect(button.hasAttribute('disabled')).toBe(true);
		resolveLogin(jsonResponse(200, { accessToken: 'a1', refreshToken: 'r1', user: USER }));
		await screen.findByText('protected-home');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('network failure shows a safe message (no stack, no token)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')));
		renderLogin();

		fireEvent.change(await screen.findByLabelText(/email/i), { target: { value: 'ops@example.com' } });
		fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: 's3nha-f0rte' } });
		fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

		const alert = await screen.findByRole('alert');
		expect(alert.textContent ?? '').not.toMatch(/stack|token|Bearer/i);
	});
});

describe('route guards', () => {
	afterEach(async () => {
		await logoutUser();
		cleanup();
		vi.unstubAllGlobals();
		window.localStorage.clear();
	});

	function renderAt(path: string) {
		const router = createMemoryRouter(
			[
				{
					element: <ProtectedRoute />,
					children: [{ path: '/secret', element: <div>secret</div> }],
				},
				{ element: <PublicOnlyRoute />, children: [{ path: '/login', element: <div>login</div> }] },
			],
			{ initialEntries: [path] },
		);
		render(
			<AuthProvider>
				<RouterProvider router={router} />
			</AuthProvider>,
		);
	}

	it('unauthenticated users are sent to login', async () => {
		renderAt('/secret');
		expect(await screen.findByText('login')).toBeTruthy();
	});

	it('initialization shows loading, never protected content', async () => {
		window.localStorage.setItem('axis.refreshToken', 'refresh-stale');
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(401, { error: 'x' }))));
		renderAt('/secret');
		// Loading boundary appears while the stale token is being validated...
		expect(await screen.findByText(/verificando sessão/i)).toBeTruthy();
		// ...then the failure lands on login, with storage cleared.
		expect(await screen.findByText('login')).toBeTruthy();
		await waitFor(() => expect(window.localStorage.getItem('axis.refreshToken')).toBeNull());
	});
});
