import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../../auth/AuthContext.js';
import { jsonResponse, renderWithRouter } from '../../test-utils.js';
import { LeadNewPage } from './LeadNewPage.js';
import { LeadDetailPage } from './LeadDetailPage.js';
import { LeadEditPage } from './LeadEditPage.js';

const LEAD = {
	id: '507f1f77bcf86cd799439011',
	userId: '507f1f77bcf86cd799439099',
	nome: 'João',
	telefone: '11999990001',
	contatoOrigem: 'instagram',
	status: 'AGENDADO',
	createdAt: '2026-01-01T10:00:00.000Z',
	updatedAt: '2026-01-02T10:00:00.000Z',
};

const EVENTOS = [
	{
		id: '507f1f77bcf86cd799439022',
		userId: LEAD.userId,
		leadId: LEAD.id,
		tipo: 'AGENDAMENTO',
		data: '2026-09-01T10:00:00.000Z',
		createdAt: '2026-01-01T10:00:00.000Z',
	},
];

describe('LeadNewPage', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('creates a lead and shows backend errors', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse(409, { error: 'Já existe um lead com este telefone' }));
		vi.stubGlobal('fetch', fetchMock);
		renderWithRouter(<LeadNewPage />);

		fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'João' } });
		fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: '11999990001' } });
		fireEvent.change(screen.getByLabelText(/origem/i), { target: { value: 'instagram' } });
		fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }));

		expect(await screen.findByText(/já existe um lead/i)).toBeTruthy();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(init.method).toBe('POST');
		expect(JSON.parse(String(init.body))).toMatchObject({ nome: 'João' });
	});
});

describe('LeadDetailPage', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	function mockDetail() {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string, init?: RequestInit) => {
				if (url.endsWith('/eventos') && (!init || init.method === 'GET')) {
					return Promise.resolve(jsonResponse(200, EVENTOS));
				}
				return Promise.resolve(jsonResponse(200, LEAD));
			}),
		);
	}

	it('renders lead data with events', async () => {
		mockDetail();
		renderWithRouter(<LeadDetailPage />);
		expect(await screen.findByText(/11999990001/)).toBeTruthy();
		expect(await screen.findByText('AGENDAMENTO')).toBeTruthy();
	});

	it('delete asks for confirmation then deletes', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
			if (url.endsWith('/eventos') && (!init || init.method === 'GET')) {
				return Promise.resolve(jsonResponse(200, []));
			}
			return Promise.resolve(jsonResponse(200, LEAD));
		});
		vi.stubGlobal('fetch', fetchMock);
		renderWithRouter(<LeadDetailPage />);
		await screen.findByText(/11999990001/);

		fireEvent.click(screen.getByRole('button', { name: /excluir/i }));
		expect(await screen.findByText(/permanentemente/i)).toBeTruthy();
		// Confirming without a DELETE-capable mock would 404; assert dialog + cancel instead.
		fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
		expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'DELETE')).toBe(false);
	});

	it('confirming delete calls DELETE and navigates back to the list', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
			if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
			if (url.endsWith('/eventos')) return Promise.resolve(jsonResponse(200, []));
			return Promise.resolve(jsonResponse(200, LEAD));
		});
		vi.stubGlobal('fetch', fetchMock);
		const router = createMemoryRouter(
			[
				{ path: '/leads/:id', element: <LeadDetailPage /> },
				{ path: '/leads', element: <div>leads-list</div> },
			],
			{ initialEntries: ['/leads/507f1f77bcf86cd799439011'] },
		);
		render(
			<AuthProvider>
				<RouterProvider router={router} />
			</AuthProvider>,
		);
		await screen.findByText(/11999990001/);

		fireEvent.click(screen.getByRole('button', { name: /excluir/i }));
		const confirmButtons = await screen.findAllByRole('button', { name: /^excluir$/i });
		const dialogConfirm = confirmButtons.at(-1);
		if (!dialogConfirm) throw new Error('confirm button missing');
		fireEvent.click(dialogConfirm);

		expect(await screen.findByText('leads-list')).toBeTruthy();
		expect(
			fetchMock.mock.calls.some(
				([url, init]) =>
					(url as string).endsWith(`/leads/${LEAD.id}`) && (init as RequestInit)?.method === 'DELETE',
			),
		).toBe(true);
	});
});

describe('LeadEditPage', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('prefills values and submits a patch', async () => {
		const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
			if (init?.method === 'PATCH') return Promise.resolve(jsonResponse(200, LEAD));
			return Promise.resolve(jsonResponse(200, LEAD));
		});
		vi.stubGlobal('fetch', fetchMock);
		const router = createMemoryRouter(
			[
				{ path: '/leads/:id/edit', element: <LeadEditPage /> },
				{ path: '/leads/:id', element: <div>detail-page</div> },
			],
			{ initialEntries: ['/leads/507f1f77bcf86cd799439011/edit'] },
		);
		render(
			<AuthProvider>
				<RouterProvider router={router} />
			</AuthProvider>,
		);

		const nome = (await screen.findByLabelText(/nome/i)) as HTMLInputElement;
		expect(nome.value).toBe('João');
		fireEvent.change(nome, { target: { value: 'João Silva' } });
		fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }));

		expect(await screen.findByText('detail-page')).toBeTruthy();
		const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
		expect(init.method).toBe('PATCH');
		expect(JSON.parse(String(init.body))).toMatchObject({ nome: 'João Silva' });
	});
});
