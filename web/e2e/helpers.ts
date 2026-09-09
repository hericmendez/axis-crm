import { expect, type Page } from '@playwright/test';

export const USERS = {
	a: { email: 'e2e-a@example.com', password: 'senha-forte-123' },
	b: { email: 'e2e-b@example.com', password: 'senha-forte-123' },
} as const;

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Senha').fill(password);
	await page.getByRole('button', { name: 'Entrar' }).click();
	// Authenticated shell renders the sidebar navigation.
	await expect(page.getByRole('navigation')).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Sair' }).click();
	await expect(page).toHaveURL(/\/login$/);
}

export async function apiToken(
	request: import('@playwright/test').APIRequestContext,
	email: string,
	password: string,
): Promise<string> {
	const res = await request.post('http://127.0.0.1:3101/api/auth/login', { data: { email, password } });
	if (res.status() !== 200) throw new Error(`seed login failed for ${email}`);
	const body = (await res.json()) as { accessToken: string };
	return body.accessToken;
}

export async function apiCreateLead(
	request: import('@playwright/test').APIRequestContext,
	token: string,
	input: Record<string, unknown>,
): Promise<{ id: string }> {
	const res = await request.post('http://127.0.0.1:3101/api/leads', {
		headers: { Authorization: `Bearer ${token}` },
		data: input,
	});
	if (res.status() !== 201) throw new Error(`seed lead failed: ${res.status()}`);
	return (await res.json()) as { id: string };
}
