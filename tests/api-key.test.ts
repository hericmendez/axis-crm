import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../src/config/env.js', () => ({
	getEnv: vi.fn(() => ({ API_KEY: 'secret-key' })),
	loadEnv: vi.fn(),
}));

const { apiKeyAuth } = await import('../src/middlewares/api-key.middleware.js');

function buildApp() {
	const app = express();
	app.use(apiKeyAuth);
	app.get('/api/leads', (_req, res) => res.json({ ok: true }));
	app.get('/health', (_req, res) => res.json({ status: 'ok' }));
	return app;
}

describe('apiKeyAuth middleware', () => {
	it('permite /health sem api key', async () => {
		const res = await request(buildApp()).get('/health');
		expect(res.status).toBe(200);
	});

	it('rejeita requisição sem api key', async () => {
		const res = await request(buildApp()).get('/api/leads');
		expect(res.status).toBe(401);
	});

	it('rejeita api key incorreta', async () => {
		const res = await request(buildApp()).get('/api/leads').set('x-api-key', 'errada');
		expect(res.status).toBe(401);
	});

	it('aceita api key correta', async () => {
		const res = await request(buildApp()).get('/api/leads').set('x-api-key', 'secret-key');
		expect(res.status).toBe(200);
	});
});
