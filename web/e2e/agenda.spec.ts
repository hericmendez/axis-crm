import { expect, test } from '@playwright/test';
import { USERS, apiCreateLead, apiToken, loginAs } from './helpers.js';

const D1 = '2027-06-10T10:00';
const D2 = '2027-06-12T14:00';

test.describe('agenda lifecycle in the panel', () => {
	test('schedule, reschedule and cancel an appointment', async ({ page, request }) => {
		const token = await apiToken(request, USERS.a.email, USERS.a.password);
		const lead = await apiCreateLead(request, token, {
			nome: 'Lead Agenda E2E',
			telefone: '11999990043',
			contatoOrigem: 'e2e',
		});

		await loginAs(page, USERS.a.email, USERS.a.password);
		await page.getByRole('link', { name: 'Agenda' }).click();

		// Widen the range to the deterministic 2027 fixtures.
		await page.locator('label', { hasText: /^De / }).locator('input').fill('2027-06-01');
		await page.locator('label', { hasText: /^Até/ }).locator('input').fill('2027-06-20');
		await page.getByRole('button', { name: 'Buscar' }).click();

		// Schedule through the panel (lead search -> select -> date -> submit).
		await page.getByRole('button', { name: 'Novo agendamento' }).click();
		const booking = page.locator('form').filter({ hasText: 'Buscar lead' });
		await booking.getByPlaceholder('Nome').fill('Lead Agenda E2E');
		await booking.getByRole('button', { name: 'Buscar' }).click();
		await page.getByLabel('Lead', { exact: true }).selectOption(lead.id);
		await page.getByLabel('Data e hora').fill(D1);
		await page.getByRole('button', { name: 'Agendar' }).click();
		await expect(page.getByText('Lead Agenda E2E')).toBeVisible();

		// Reschedule to a new date.
		await page.getByRole('button', { name: 'Reagendar' }).click();
		await page.getByLabel('Nova data e hora').fill(D2);
		await page.getByRole('button', { name: 'Confirmar' }).click();
		await expect(page.getByText('Lead Agenda E2E')).toBeVisible();

		// Cancel with confirmation (the rescheduled, still-active row).
		await page.locator('tr', { hasText: 'REAGENDAMENTO' }).getByRole('button', { name: 'Cancelar' }).click();
		await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar compromisso' }).click();

		// The agenda keeps history: verify the cancellation landed in the
		// domain (DESISTENCIA linked to the rescheduled event) via the API.
		await expect(async () => {
			const res = await request.get(`http://127.0.0.1:3101/api/leads/${lead.id}/eventos`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			expect(res.status()).toBe(200);
			const eventos = (await res.json()) as Array<{ tipo: string; previousEventoId?: string }>;
			const cancel = eventos.find((e) => e.tipo === 'DESISTENCIA');
			expect(cancel?.previousEventoId).toBeDefined();
		}).toPass();
	});
});
