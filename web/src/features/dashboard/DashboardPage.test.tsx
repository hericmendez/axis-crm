import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { jsonResponse, renderWithRouter } from '../../test-utils.js';
import { DashboardPage } from './DashboardPage.js';

const METRICAS = {
	leadsPorStatus: [
		{ status: 'AGENDADO', total: 3 },
		{ status: 'VENDIDO', total: 1 },
	],
	eventosPorTipo: [{ tipo: 'AGENDAMENTO', total: 2 }],
	taxaConversao: { totalLeads: 4, vendidos: 1, taxaConversao: 0.25 },
};

describe('DashboardPage', () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('renders metrics from the API', async () => {
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, METRICAS))));
		renderWithRouter(<DashboardPage />);

		expect(await screen.findByText('Dashboard')).toBeTruthy();
		expect(await screen.findByText('4')).toBeTruthy();
		expect(await screen.findByText('25.0%')).toBeTruthy();
		expect(await screen.findByText(/AGENDADO: 3/)).toBeTruthy();
	});

	it('shows loading then error with retry', async () => {
		let calls = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => {
				calls += 1;
				return Promise.resolve(
					calls === 1 ? jsonResponse(500, { error: 'x' }) : jsonResponse(200, METRICAS),
				);
			}),
		);
		renderWithRouter(<DashboardPage />);

		const retry = await screen.findByRole('button', { name: /tentar novamente/i });
		retry.click();
		expect(await screen.findByText('25.0%')).toBeTruthy();
		expect(calls).toBe(2);
	});

	it('shows empty state when there are no leads', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => 
				jsonResponse(200, {
					leadsPorStatus: [],
					eventosPorTipo: [],
					taxaConversao: { totalLeads: 0, vendidos: 0, taxaConversao: 0 },
				}),
			),
		);
		renderWithRouter(<DashboardPage />);
		expect(await screen.findByText(/nenhum lead/i)).toBeTruthy();
	});
});
