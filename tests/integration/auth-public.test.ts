import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import * as authService from '../../src/services/auth.service.js';

vi.mock('../../src/config/env.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/config/env.js')>();
	return {
		...actual,
		getEnv: () => ({ ...actual.getEnv(), API_KEY: 'secret-key' }),
	};
});

import { createApp } from '../../src/app.js';

// Com API_KEY configurada (produção): login continua público, domínio exige credencial.
describe('rotas públicas com API_KEY configurada', () => {
	beforeAll(async () => {
		const uri = await startTestMongo();
		await mongoose.connect(uri);
	});

	beforeEach(async () => {
		await clearCollections();
	});

	afterAll(async () => {
		await stopTestMongo();
	});

	it('login funciona sem x-api-key', async () => {
		await authService.createUserWithPassword({
			name: 'Admin',
			email: 'admin@example.com',
			password: 'senha-forte-123',
		});
		const res = await request(createApp())
			.post('/api/auth/login')
			.send({ email: 'admin@example.com', password: 'senha-forte-123' });
		expect(res.status).toBe(200);
		expect(typeof res.body.accessToken).toBe('string');
	});

	it('refresh/logout públicos não exigem API key', async () => {
		const app = createApp();
		expect((await request(app).post('/api/auth/refresh').send({ refreshToken: 'x' })).status).toBe(401);
		expect((await request(app).post('/api/auth/logout').send({})).status).toBe(200);
	});

	it('domínio sem credencial → 401; com chave errada → 401', async () => {
		const app = createApp();
		expect((await request(app).get('/api/leads')).status).toBe(401);
		expect((await request(app).get('/api/leads').set('x-api-key', 'errada')).status).toBe(401);
	});

	it('domínio com chave correta continua funcionando (machine)', async () => {
		const app = createApp();
		const res = await request(app).get('/api/leads').set('x-api-key', 'secret-key');
		expect(res.status).toBe(200);
	});

	it('JWT continua aceito sem x-api-key (humano)', async () => {
		await authService.createUserWithPassword({
			name: 'Admin',
			email: 'admin@example.com',
			password: 'senha-forte-123',
		});
		const app = createApp();
		const login = await request(app)
			.post('/api/auth/login')
			.send({ email: 'admin@example.com', password: 'senha-forte-123' });
		const res = await request(app)
			.get('/api/leads')
			.set('Authorization', `Bearer ${login.body.accessToken}`);
		expect(res.status).toBe(200);
	});

	it('/health continua público', async () => {
		expect((await request(createApp()).get('/health')).status).toBe(200);
	});

	it('JSON malformado retorna 400 sem vazar internals', async () => {
		const res = await request(createApp())
			.post('/api/auth/login')
			.set('Content-Type', 'application/json')
			.send('{"email":INVALID}');
		expect(res.status).toBe(400);
		expect(res.body).toEqual({ error: 'Corpo da requisição inválido' });
	});
});
