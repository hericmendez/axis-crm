import request from 'supertest';
import type { Express } from 'express';
import { expect } from 'vitest';
import * as authService from '../../src/services/auth.service.js';

// Creates a user and returns a Bearer token for API tests.
// Each caller passes a distinct email when a test needs multiple tenants.
export async function loginAs(
	app: Express,
	email = 'user@example.com',
	password = 'senha-forte-123',
): Promise<string> {
	await authService.createUserWithPassword({ name: 'Test User', email, password });
	const res = await request(app).post('/api/auth/login').send({ email, password });
	expect(res.status).toBe(200);
	return res.body.accessToken as string;
}

export function bearer(token: string): { Authorization: string } {
	return { Authorization: `Bearer ${token}` };
}
