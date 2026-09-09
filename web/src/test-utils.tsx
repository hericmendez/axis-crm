import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider } from './auth/AuthContext.js';

export function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

// Renders UI inside the real AuthProvider + a memory router. Authenticated
// session (if any) comes from login flows or setSession, like production.
export function renderWithRouter(ui: ReactNode, path = '/'): RenderResult {
	const router = createMemoryRouter([{ path: '*', element: <>{ui}</> }], {
		initialEntries: [path],
	});
	return render(
		<AuthProvider>
			<RouterProvider router={router} />
		</AuthProvider>,
	);
}
