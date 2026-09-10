import { expect, test } from '@playwright/test';
import { USERS, loginAs } from './helpers.js';

test.describe('responsive behavior', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('mobile drawer navigates and theme toggle persists', async ({ page }) => {
		await loginAs(page, USERS.a.email, USERS.a.password);

		// Hamburger opens the drawer; navigation closes it.
		await page.getByRole('button', { name: /abrir navegação/i }).click();
		await expect(page.getByRole('dialog', { name: 'Navegação principal' })).toBeVisible();
		await page.getByRole('dialog').getByRole('link', { name: 'Leads' }).click();
		await expect(page).toHaveURL(/\/leads$/);
		await expect(page.getByRole('dialog', { name: 'Navegação principal' })).toBeHidden();

		// Theme toggle works and persists across reloads.
		await page.getByRole('button', { name: /tema escuro/i }).click();
		await expect(page.locator('html')).toHaveClass(/dark/);
		await page.reload();
		await expect(page.locator('html')).toHaveClass(/dark/);
		await expect(page.getByRole('button', { name: /tema claro/i })).toBeVisible();
	});
});
