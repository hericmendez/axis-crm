import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { jsonResponse, renderWithRouter } from '../../test-utils.js';
import { LeadsPage } from './LeadsPage.js';

const LEAD_A = {
	id: '507f1f77bcf86cd799439011',
	userId: '507f1f77bcf86cd799439099',
	nome: 'João',
	telefone: '11999990001',
	contatoOrigem: 'w',
	createdAt: '2026-01-01T00:00:00.000Z',
	updatedAt: '2026-01-01T00:00:00.000Z',
};

const PAGE = { items: [LEAD_A], total: 1, page: 1, limit: 20 };

describe('LeadsPage', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('renders the lead list', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, PAGE))));
		renderWithRouter(<LeadsPage />);

		expect(await screen.findByText('João')).toBeTruthy();
		expect(await screen.findByText(/11999990001/)).toBeTruthy();
	});

	it('applies server-side filters from the form', async () => {
		const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, PAGE)));
		vi.stubGlobal('fetch', fetchMock);
		renderWithRouter(<LeadsPage />);
		await screen.findByText('João');

		fireEvent.change(screen.getByPlaceholderText('Nome'), { target: { value: 'joão' } });
		fireEvent.click(screen.getByRole('button', { name: /filtrar/i }));

		await screen.findByText('João');
		const lastUrl = fetchMock.mock.calls.at(-1)?.[0] as string;
		expect(lastUrl).toContain('nome=jo%C3%A3o');
	});

	it('shows empty state when there are no leads', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, { items: [], total: 0, page: 1, limit: 20 }))),
		);
		renderWithRouter(<LeadsPage />);
		expect(await screen.findByText(/nenhum lead/i)).toBeTruthy();
	});

	it('shows API error with retry', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(500, { error: 'boom' }))));
		renderWithRouter(<LeadsPage />);
		expect(await screen.findByText('boom')).toBeTruthy();
		expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeTruthy();
	});
});
