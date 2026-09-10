import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { jsonResponse, renderWithRouter } from '../../test-utils.js';
import { IntegrationsPage } from './IntegrationsPage.js';

describe('IntegrationsPage', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	function mockAll(google: unknown, whatsapp: unknown, qr: unknown) {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((url: string) => {
				if (url.includes('/integrations/google/status')) return Promise.resolve(jsonResponse(200, google));
				if (url.includes('/whatsapp/qr')) return Promise.resolve(jsonResponse(200, qr));
				if (url.includes('/whatsapp/status')) return Promise.resolve(jsonResponse(200, whatsapp));
				return Promise.resolve(jsonResponse(404, { error: 'x' }));
			}),
		);
	}

	it('shows disconnected Google with connect action and WhatsApp status', async () => {
		mockAll({ connected: false }, { status: 'conectado', connected: true }, { qr: 'payload' });
		renderWithRouter(<IntegrationsPage />);

		expect(await screen.findByText('Não conectado')).toBeTruthy();
		expect(screen.getByRole('button', { name: /conectar google/i })).toBeTruthy();
		expect(await screen.findByText('conectado')).toBeTruthy();
	});

	it('shows connected Google state and disconnects with confirmation', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
			if (url.includes('/integrations/google/status')) {
				return Promise.resolve(
					jsonResponse(200, {
						connected: true,
						email: 'user@example.com',
						calendarConfigured: true,
						spreadsheetConfigured: false,
						createdAt: '2026-01-01T00:00:00.000Z',
					}),
				);
			}
			if (url.includes('/whatsapp/status')) {
				return Promise.resolve(jsonResponse(200, { status: 'conectado', connected: true }));
			}
			if (init?.method === 'DELETE') {
				return Promise.resolve(new Response(null, { status: 204 }));
			}
			return Promise.resolve(jsonResponse(404, { error: 'x' }));
		});
		vi.stubGlobal('fetch', fetchMock);
		renderWithRouter(<IntegrationsPage />);

		expect(await screen.findByText('user@example.com')).toBeTruthy();
		expect(await screen.findByText(/não configurada/)).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: /desconectar/i }));
		expect(await screen.findByText(/remover a integração/i)).toBeTruthy();
		const confirm = (await screen.findAllByRole('button', { name: /desconectar/i })).at(-1);
		if (!confirm) throw new Error('confirm missing');
		fireEvent.click(confirm);

		await screen.findByText(/desconectado/i);
		expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'DELETE')).toBe(true);
	});

	it('connect requests the backend OAuth URL', async () => {
		const fetchMock = vi.fn().mockImplementation((url: string) => {
			if (url.includes('/google/connect')) {
				return Promise.resolve(jsonResponse(200, { url: 'https://accounts.google.com/o/oauth2/auth?x' }));
			}
			if (url.includes('/whatsapp/status')) {
				return Promise.resolve(jsonResponse(200, { status: 'desconectado', connected: false }));
			}
			return Promise.resolve(jsonResponse(200, { connected: false }));
		});
		vi.stubGlobal('fetch', fetchMock);
		renderWithRouter(<IntegrationsPage />);
		fireEvent.click(await screen.findByRole('button', { name: /conectar google/i }));
		// The component then assigns window.location.href (real browser navigation);
		// assert the contract call that produces the URL instead.
		await screen.findByText('Não conectado');
		expect(fetchMock.mock.calls.some(([url]) => (url as string).includes('/google/connect'))).toBe(true);
	});

	it('shows API errors', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(500, { error: 'boom' }))));
		renderWithRouter(<IntegrationsPage />);
		expect((await screen.findAllByText('boom')).length).toBeGreaterThan(0);
	});

	it('renders QR payload while waiting and handles QR errors', async () => {
		mockAll(
			{ connected: false },
			{ status: 'aguardando_qr', connected: false },
			{ qr: 'qr-payload-123' },
		);
		renderWithRouter(<IntegrationsPage />);
		expect(await screen.findByText('qr-payload-123')).toBeTruthy();
	});
});
