import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { jsonResponse, renderWithRouter } from '../../test-utils.js';
import { AgendaPage } from './AgendaPage.js';

const VIEW = {
	de: '2026-09-10T00:00:00.000Z',
	ate: '2026-09-11T00:00:00.000Z',
	eventos: [
		{
			id: '507f1f77bcf86cd799439022',
			origem: 'domain',
			titulo: 'João',
			inicio: '2026-09-10T14:00:00.000Z',
			fim: '2026-09-10T15:00:00.000Z',
			allDay: false,
			tipo: 'AGENDAMENTO',
			leadId: '507f1f77bcf86cd799439011',
			leadNome: 'João',
		},
	],
	ocupacao: [{ inicio: '2026-09-10T14:00:00.000Z', fim: '2026-09-10T15:00:00.000Z' }],
	disponibilidade: [{ inicio: '2026-09-10T00:00:00.000Z', fim: '2026-09-10T14:00:00.000Z' }],
	calendarStatus: 'OK',
};

describe('AgendaPage', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('renders events with origin and actions', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, VIEW))));
		renderWithRouter(<AgendaPage />);

		expect((await screen.findAllByText('João')).length).toBeGreaterThan(0);
		expect((await screen.findAllByText('Axis')).length).toBeGreaterThan(0);
		const table = screen.getByRole('table');
		expect(within(table).getByRole('button', { name: /reagendar/i })).toBeTruthy();
		expect(within(table).getByRole('button', { name: /^cancelar$/i })).toBeTruthy();
	});

	it('shows empty state when there are no events', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, { ...VIEW, eventos: [] }))));
		renderWithRouter(<AgendaPage />);
		expect(await screen.findByText(/nenhum compromisso/i)).toBeTruthy();
	});

	it('shows API error with retry', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(500, { error: 'boom' }))));
		renderWithRouter(<AgendaPage />);
		expect(await screen.findByText('boom')).toBeTruthy();
	});

	it('warns when Google Calendar is unavailable', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, { ...VIEW, calendarStatus: 'NO_CONNECTION' }))),
		);
		renderWithRouter(<AgendaPage />);
		expect(await screen.findByText(/google calendar não conectado/i)).toBeTruthy();
	});

	it('cancel asks for confirmation and posts DESISTENCIA with eventoId', async () => {
		const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
			if (init?.method === 'POST') {
				return Promise.resolve(
					jsonResponse(201, { id: 'novo', tipo: 'DESISTENCIA', previousEventoId: '507f1f77bcf86cd799439022' }),
				);
			}
			return Promise.resolve(jsonResponse(200, VIEW));
		});
		vi.stubGlobal('fetch', fetchMock);
		renderWithRouter(<AgendaPage />);
		await within(await screen.findByRole('table')).findByText('João');
		const table = screen.getByRole('table');
		fireEvent.click(within(table).getByRole('button', { name: /^cancelar$/i }));
		expect(await screen.findByText(/cancelar "joão"/i)).toBeTruthy();
		const confirm = (await screen.findAllByRole('button', { name: /cancelar compromisso/i })).at(-1);
		if (!confirm) throw new Error('confirm missing');
		fireEvent.click(confirm);

		await waitFor(() =>
			expect(
				fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'POST'),
			).toBe(true),
		);
		const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
		if (!post) throw new Error('POST missing');
		const [, init] = post as [string, RequestInit];
		expect(init.method).toBe('POST');
		expect(JSON.parse(String(init.body))).toMatchObject({
			tipo: 'DESISTENCIA',
			eventoId: '507f1f77bcf86cd799439022',
		});
	});

	it('reschedule posts REAGENDAMENTO with eventoId and new date', async () => {
		const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
			if (init?.method === 'POST') {
				return Promise.resolve(jsonResponse(201, { id: 'novo', tipo: 'REAGENDAMENTO' }));
			}
			return Promise.resolve(jsonResponse(200, VIEW));
		});
		vi.stubGlobal('fetch', fetchMock);
		renderWithRouter(<AgendaPage />);
		await within(await screen.findByRole('table')).findByText('João');
		const table = screen.getByRole('table');
		fireEvent.click(within(table).getByRole('button', { name: /reagendar/i }));
		const input = (await screen.findByLabelText(/nova data/i)) as HTMLInputElement;
		fireEvent.change(input, { target: { value: '2026-09-12T10:00' } });
		fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

		await waitFor(() =>
			expect(
				fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === 'POST'),
			).toBe(true),
		);
		const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit)?.method === 'POST');
		if (!post) throw new Error('POST missing');
		const [, init] = post as [string, RequestInit];
		expect(JSON.parse(String(init.body))).toMatchObject({
			tipo: 'REAGENDAMENTO',
			eventoId: '507f1f77bcf86cd799439022',
		});
	});
});
