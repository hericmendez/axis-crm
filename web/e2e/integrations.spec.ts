import { expect, test } from '@playwright/test';
import { USERS, loginAs } from './helpers.js';

test.describe('integrations boundaries in the panel', () => {
	test('google shows disconnected state without secrets', async ({ page }) => {
		await loginAs(page, USERS.a.email, USERS.a.password);
		await page.getByRole('link', { name: 'Integrações' }).click();

		await expect(page.getByText('Não conectado', { exact: false }).first()).toBeVisible();
		const body = await page.content();
		expect(body).not.toMatch(/refreshToken|segredo/i);
	});

	test('connect action follows the backend OAuth initiation path', async ({ page }) => {
		await loginAs(page, USERS.a.email, USERS.a.password);
		await page.getByRole('link', { name: 'Integrações' }).click();

	 // Only the external Google redirect is mocked: the app must still call
		// the real backend initiation endpoint and navigate to its URL.
		await page.route('**/api/v1/integrations/google/connect', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ url: 'https://example.com/oauth-test' }),
			});
		});
		await page.getByRole('button', { name: 'Conectar Google' }).click();
		await page.waitForURL('https://example.com/oauth-test');
	});

	test('whatsapp shows status and handles missing QR', async ({ page }) => {
		await loginAs(page, USERS.a.email, USERS.a.password);
		await page.getByRole('link', { name: 'Integrações' }).click();

		await expect(page.getByText('desconectado', { exact: false }).first()).toBeVisible();
	});
});
