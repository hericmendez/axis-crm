import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo } from './setup.js';
import { createApp } from '../../src/app.js';

// PANEL_ORIGIN vem de tests/setup.ts:
// 'https://panel.example.com,http://localhost:5173'
describe('CORS', () => {
	beforeAll(async () => {
		const uri = await startTestMongo();
		await mongoose.connect(uri);
	});

	afterAll(async () => {
		await stopTestMongo();
	});

	it('origem listada recebe Access-Control-Allow-Origin refletida', async () => {
		const res = await request(createApp())
			.get('/health')
			.set('Origin', 'https://panel.example.com');
		expect(res.status).toBe(200);
		expect(res.headers['access-control-allow-origin']).toBe('https://panel.example.com');
		expect(res.headers['vary']).toMatch(/origin/i);
	});

	it('origem não listada não recebe headers CORS', async () => {
		const res = await request(createApp()).get('/health').set('Origin', 'https://evil.example.com');
		expect(res.status).toBe(200);
		expect(res.headers['access-control-allow-origin']).toBeUndefined();
	});

	it('requisição sem Origin passa normalmente (same-origin / não-browser)', async () => {
		const res = await request(createApp()).get('/health');
		expect(res.status).toBe(200);
		expect(res.headers['access-control-allow-origin']).toBeUndefined();
	});

	it('preflight de origem listada é autorizado sem vazar credenciais', async () => {
		const res = await request(createApp())
			.options('/api/leads')
			.set('Origin', 'http://localhost:5173')
			.set('Access-Control-Request-Method', 'POST');
		expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
		expect(res.headers['access-control-allow-credentials']).toBeUndefined();
	});

	it('nunca emite wildcard', async () => {
		const res = await request(createApp())
			.get('/health')
			.set('Origin', 'https://panel.example.com');
		expect(res.headers['access-control-allow-origin']).not.toBe('*');
	});
});
