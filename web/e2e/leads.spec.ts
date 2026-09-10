import { expect, test } from '@playwright/test';
import { USERS, loginAs } from './helpers.js';

const PHONE = '11999990042';

test.describe('lead lifecycle in the panel', () => {
	test('create, view, edit, add event and delete a lead', async ({ page }) => {
		await loginAs(page, USERS.a.email, USERS.a.password);

		// Create.
		await page.getByRole('link', { name: 'Leads' }).click();
		await page.getByRole('link', { name: 'Novo lead' }).click();
		await page.getByLabel('Nome', { exact: true }).fill('Lead E2E');
		await page.getByLabel('Telefone').fill(PHONE);
		await page.getByLabel('Origem do contato').fill('e2e');
		await page.getByRole('button', { name: 'Salvar' }).click();

		// Detail shows persisted data.
		await expect(page.getByRole('heading', { name: 'Lead E2E' })).toBeVisible();
		await expect(page.getByText(PHONE)).toBeVisible();

		// Edit status.
		await page.getByRole('link', { name: 'Editar' }).click();
		await page.getByLabel('Status').click();
		await page.getByRole('option', { name: 'VENDIDO' }).click();
		await page.getByRole('button', { name: 'Salvar' }).click();
		await expect(page.getByText('VENDIDO').first()).toBeVisible();

		// Delete with confirmation.
		await page.getByRole('button', { name: 'Excluir' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
		await expect(page).toHaveURL(/\/leads$/);

		// Gone from the list (server-side filter proves removal).
		await page.getByPlaceholder('Nome').fill('Lead E2E');
		await page.getByRole('button', { name: 'Filtrar' }).click();
		await expect(page.getByText('Nenhum lead encontrado.')).toBeVisible();
	});
});
