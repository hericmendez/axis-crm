import { expect, test } from '@playwright/test';
import { USERS, apiCreateLead, apiToken, loginAs } from './helpers.js';

test.describe('conversations and dashboard in the panel', () => {
	test('seeded conversation lists, opens with ordered messages', async ({ page }) => {
		await loginAs(page, USERS.a.email, USERS.a.password);
		await page.getByRole('link', { name: 'Conversas' }).click();

	 await expect(page.getByText('5511999999999@c.us')).toBeVisible();
		await page.getByText('5511999999999@c.us').click();

		// Seeded messages render in chronological order.
		const messages = page.locator('.axis-message');
		await expect(messages).toHaveCount(2);
		expect(await messages.first().innerText()).toContain('Olá, quero agendar');
		expect(await messages.nth(1).innerText()).toContain('Claro, qual dia?');
	});

	test('dashboard numbers match the metrics endpoint', async ({ page, request }) => {
		const token = await apiToken(request, USERS.a.email, USERS.a.password);
	 const lead = await apiCreateLead(request, token, {
			nome: 'Lead Dashboard E2E',
			telefone: '11999990044',
			contatoOrigem: 'e2e',
		});
		const created = await request.post(`http://127.0.0.1:3101/api/leads/${lead.id}/eventos`, {
			headers: { Authorization: `Bearer ${token}` },
			data: { tipo: 'VENDA' },
		});
		expect(created.status()).toBe(201);

		const metrics = await request.get(
			'http://127.0.0.1:3101/api/metricas?de=2027-01-01T00:00:00.000Z&ate=2028-01-01T00:00:00.000Z',
			{ headers: { Authorization: `Bearer ${token}` } },
		);
	 const expected = (await metrics.json()) as {
			taxaConversao: { totalLeads: number; vendidos: number; taxaConversao: number };
		};

		await loginAs(page, USERS.a.email, USERS.a.password);
		// Dashboard is the landing page after login.
		await expect(page.getByText(String(expected.taxaConversao.totalLeads)).first()).toBeVisible();
		const pct = `${(expected.taxaConversao.taxaConversao * 100).toFixed(1)}%`;
		await expect(page.getByText(pct)).toBeVisible();
	});
});
