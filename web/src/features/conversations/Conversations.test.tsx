import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthProvider } from '../../auth/AuthContext.js';
import { jsonResponse, renderWithRouter } from '../../test-utils.js';
import { ConversationsPage } from './ConversationsPage.js';
import { ConversationDetailPage } from './ConversationDetailPage.js';

const CONVERSA = {
	id: '507f1f77bcf86cd799439033',
	userId: '507f1f77bcf86cd799439099',
	canal: 'whatsapp',
	chatIdExterno: '5511999999999@c.us',
	leadId: '507f1f77bcf86cd799439011',
	mensagens: [
		{ id: 'm1', papel: 'usuario', conteudo: 'Oi, quero agendar', criadoEm: '2026-09-01T10:00:00.000Z' },
		{ id: 'm2', papel: 'axis', conteudo: 'Claro! Qual dia?', criadoEm: '2026-09-01T10:01:00.000Z' },
	],
	createdAt: '2026-09-01T10:00:00.000Z',
	updatedAt: '2026-09-01T10:01:00.000Z',
};

const PAGE = { items: [CONVERSA], total: 1, page: 1, limit: 20 };

describe('ConversationsPage', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('renders the conversation list', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, PAGE))));
		renderWithRouter(<ConversationsPage />);

		expect((await screen.findAllByText('5511999999999@c.us')).length).toBeGreaterThan(0);
		expect((await screen.findAllByText('whatsapp')).length).toBeGreaterThan(0);
	});

	it('shows empty and error states', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, { items: [], total: 0, page: 1, limit: 20 }))),
		);
		renderWithRouter(<ConversationsPage />);
		expect(await screen.findByText(/nenhuma conversa/i)).toBeTruthy();
		cleanup();

		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(500, { error: 'boom' }))));
		renderWithRouter(<ConversationsPage />);
		expect(await screen.findByText('boom')).toBeTruthy();
	});

	it('filter is sent server-side', async () => {
		const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, PAGE)));
		vi.stubGlobal('fetch', fetchMock);
		renderWithRouter(<ConversationsPage />);
		await within(await screen.findByRole('table')).findByText('5511999999999@c.us');

		fireEvent.change(screen.getByPlaceholderText(/5511/i), { target: { value: '5511' } });
		fireEvent.click(screen.getByRole('button', { name: /filtrar/i }));

		await within(await screen.findByRole('table')).findByText('5511999999999@c.us');
		const lastUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
		expect(lastUrl).toContain('chatIdExterno=5511');
	});
});

describe('ConversationDetailPage', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	function renderDetail() {
		const router = createMemoryRouter(
			[{ path: '/conversations/:id', element: <ConversationDetailPage /> }],
			{ initialEntries: ['/conversations/507f1f77bcf86cd799439033'] },
		);
		render(
			<AuthProvider>
				<RouterProvider router={router} />
			</AuthProvider>,
		);
	}

	it('renders messages with distinguished roles', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, CONVERSA))));
		renderDetail();

		expect(await screen.findByText('Oi, quero agendar')).toBeTruthy();
		expect(await screen.findByText('Claro! Qual dia?')).toBeTruthy();
		expect(await screen.findByText('Cliente')).toBeTruthy();
		expect(await screen.findByText('Axis')).toBeTruthy();
		expect(await screen.findByText(/ver lead/i)).toBeTruthy();
	});

	it('shows API error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(404, { error: 'Conversa não encontrada' }))));
		renderDetail();
		expect(await screen.findByText('Conversa não encontrada')).toBeTruthy();
	});
});
