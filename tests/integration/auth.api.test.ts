import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import { createApp } from '../../src/app.js';
import { UserModel } from '../../src/models/user.model.js';
import { RefreshTokenModel } from '../../src/models/refresh-token.model.js';
import * as authService from '../../src/services/auth.service.js';

beforeAll(async () => {
	const uri = await startTestMongo();
	await mongoose.connect(uri);
});

afterAll(async () => {
	await stopTestMongo();
});

afterEach(async () => {
	await clearCollections();
});

async function createUser(email = 'admin@example.com', password = 'senha-forte-123') {
	return authService.createUserWithPassword({ name: 'Admin', email, password });
}

async function login(email = 'admin@example.com', password = 'senha-forte-123') {
	const res = await request(createApp()).post('/api/auth/login').send({ email, password });
	expect(res.status).toBe(200);
	return res.body as { accessToken: string; refreshToken: string; user: { id: string; email: string; name: string } };
}

describe('API /api/auth', () => {
	it('login válido retorna tokens + user sem segredos', async () => {
		await createUser();
		const res = await request(createApp())
			.post('/api/auth/login')
			.send({ email: 'admin@example.com', password: 'senha-forte-123' });

		expect(res.status).toBe(200);
		expect(typeof res.body.accessToken).toBe('string');
		expect(typeof res.body.refreshToken).toBe('string');
		expect(res.body.user.email).toBe('admin@example.com');
		const raw = JSON.stringify(res.body);
		expect(raw).not.toContain('passwordHash');
		expect(raw).not.toContain('senha-forte-123');
		expect(raw).not.toContain('apiKey');
	});

	it('senha inválida e email inexistente retornam o mesmo 401', async () => {
		await createUser();
		const app = createApp();
		const wrongPass = await request(app)
			.post('/api/auth/login')
			.send({ email: 'admin@example.com', password: 'errada-123' });
		const unknown = await request(app)
			.post('/api/auth/login')
			.send({ email: 'ninguem@example.com', password: 'qualquer-1' });

		expect(wrongPass.status).toBe(401);
		expect(unknown.status).toBe(401);
		expect(wrongPass.body).toEqual(unknown.body);
	});

	it('email é normalizado (case-insensitive)', async () => {
		await createUser('Admin@Example.com');
		const res = await request(createApp())
			.post('/api/auth/login')
			.send({ email: 'ADMIN@EXAMPLE.COM', password: 'senha-forte-123' });
		expect(res.status).toBe(200);
	});

	it('body malformado retorna 400 sem vazar detalhes', async () => {
		const res = await request(createApp()).post('/api/auth/login').send({ email: 'x' });
		expect(res.status).toBe(400);
	});

	it('senha é armazenada como hash, nunca plaintext', async () => {
		await createUser();
		const doc = await UserModel.findOne({ email: 'admin@example.com' }).select('+passwordHash').lean();
		expect(doc).toBeTruthy();
		expect(doc?.passwordHash).toBeTruthy();
		expect(doc?.passwordHash).not.toBe('senha-forte-123');
	});

	it('refresh válido rotaciona e invalida o anterior', async () => {
		await createUser();
		const { refreshToken } = await login();
		const app = createApp();

		const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
		expect(res.status).toBe(200);
		expect(typeof res.body.accessToken).toBe('string');
		expect(typeof res.body.refreshToken).toBe('string');
		expect(res.body.refreshToken).not.toBe(refreshToken);

		const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken });
		expect(reuse.status).toBe(401);
	});

	it('refresh expirado é rejeitado', async () => {
		const user = await createUser();
		await RefreshTokenModel.create({
			userId: user.id,
			tokenHash: 'hash-expirado',
			expiresAt: new Date(Date.now() - 1000),
		});
		const app = createApp();
		const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'qualquer' });
		expect(res.status).toBe(401);
	});

	it('refresh desconhecido é rejeitado', async () => {
		await createUser();
		const res = await request(createApp())
			.post('/api/auth/refresh')
			.send({ refreshToken: 'nunca-emitido' });
		expect(res.status).toBe(401);
	});

	it('refresh token é persistido como hash, nunca plaintext', async () => {
		await createUser();
		const { refreshToken } = await login();
		const sessions = await RefreshTokenModel.find().lean();
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.tokenHash).toBeTruthy();
		expect(sessions[0]?.tokenHash).not.toBe(refreshToken);
	});

	it('logout invalida; refresh posterior falha; logout repetido é idempotente', async () => {
		await createUser();
		const { refreshToken } = await login();
		const app = createApp();

		const out = await request(app).post('/api/auth/logout').send({ refreshToken });
		expect(out.status).toBe(200);
		expect(out.body).toEqual({ ok: true });

		const after = await request(app).post('/api/auth/refresh').send({ refreshToken });
		expect(after.status).toBe(401);

		const again = await request(app).post('/api/auth/logout').send({ refreshToken });
		expect(again.status).toBe(200);
	});

	it('logout com body malformado continua seguro e idempotente', async () => {
		const res = await request(createApp()).post('/api/auth/logout').send({});
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ ok: true });
	});

	it('Bearer válido autentica rota que exige userId (Google status)', async () => {
		await createUser();
		const { accessToken } = await login();
		const res = await request(createApp())
			.get('/api/v1/integrations/google/status')
			.set('Authorization', `Bearer ${accessToken}`);
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ connected: false });
	});

	it('Bearer inválido é rejeitado mesmo sem API key', async () => {
		const res = await request(createApp())
			.get('/api/v1/integrations/google/status')
			.set('Authorization', 'Bearer invalido');
		expect(res.status).toBe(401);
	});

	it('fluxo máquina sem credenciais agora falha fechado (401) nos endpoints de domínio', async () => {
		const res = await request(createApp()).get('/api/leads');
		expect(res.status).toBe(401);
	});
});
