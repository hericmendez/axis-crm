import { expect, test } from '@playwright/test';
import { USERS, loginAs, logout } from './helpers.js';

test.describe('authentication journey', () => {
	test('unauthenticated deep link redirects to login', async ({ page }) => {
		await page.goto('/leads');
		await expect(page).toHaveURL(/\/login$/);
		await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
	});

	test('invalid credentials show the generic message', async ({ page }) => {
		await page.goto('/login');
		await page.getByLabel('Email').fill(USERS.a.email);
		await page.getByLabel('Senha', { exact: true }).fill('senha-errada');
		await page.getByRole('button', { name: 'Entrar' }).click();
		await expect(page.getByRole('alert')).toContainText('Credenciais inválidas');
		await expect(page).toHaveURL(/\/login$/);
	});

	test('login lands on the app and logout returns to login', async ({ page }) => {
		await loginAs(page, USERS.a.email, USERS.a.password);
		await expect(page.getByRole('navigation')).toContainText('Leads');
		await logout(page);
		// Session is gone: protected route bounces back to login.
		await page.goto('/agenda');
		await expect(page).toHaveURL(/\/login$/);
	});
});
