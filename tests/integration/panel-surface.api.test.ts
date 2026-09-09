import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import { createApp } from '../../src/app.js';
import { bearer, loginAs } from './auth-helper.js';
import * as whatsappService from '../../src/whatsapp/whatsapp.service.js';
import { GoogleConnectionModel } from '../../src/models/google-connection.model.js';

describe('API panel surface (WhatsApp v1 + Google status)', () => {
	const app = createApp();

	beforeAll(async () => {
		const uri = await startTestMongo();
		await mongoose.connect(uri);
	});

	beforeEach(async () => {
		await clearCollections();
		whatsappService.setStatus('desconectado');
		whatsappService.setQr(undefined);
	});

	afterAll(async () => {
		await stopTestMongo();
		whatsappService.setStatus('desconectado');
		whatsappService.setQr(undefined);
	});

	async function auth(email = 'user@example.com') {
		return bearer(await loginAs(app, email));
	}

	it('v1 status/qr exigem identidade', async () => {
		expect((await request(app).get('/api/v1/whatsapp/status')).status).toBe(401);
		expect((await request(app).get('/api/v1/whatsapp/qr')).status).toBe(401);
	});

	it('v1 status retorna estado seguro sem segredos', async () => {
		const authHeader = await auth();
		whatsappService.setStatus('aguardando_qr');
		const res = await request(app).get('/api/v1/whatsapp/status').set(authHeader);
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ status: 'aguardando_qr', connected: false });
	});

	it('v1 qr retorna 404 quando ausente e payload quando presente', async () => {
		const authHeader = await auth();
		expect((await request(app).get('/api/v1/whatsapp/qr').set(authHeader)).status).toBe(404);

		whatsappService.setQr('qr-payload');
		const res = await request(app).get('/api/v1/whatsapp/qr').set(authHeader);
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ qr: 'qr-payload' });
	});

	it('v1 status conectado reflete connected=true', async () => {
		const authHeader = await auth();
		whatsappService.setStatus('conectado');
		const res = await request(app).get('/api/v1/whatsapp/status').set(authHeader);
		expect(res.body).toEqual({ status: 'conectado', connected: true });
	});

	it('legado /api/whatsapp/status preservado', async () => {
		const res = await request(createApp()).get('/api/whatsapp/status');
		expect(res.status).toBe(200);
		expect(res.body).toHaveProperty('status');
	});

	it('google status expõe flags seguras sem tokens', async () => {
		const token = await loginAs(app);
		const authHeader = bearer(token);

		const desconectado = await request(app).get('/api/v1/integrations/google/status').set(authHeader);
		expect(desconectado.body).toEqual({ connected: false });

		const { default: jwt } = await import('jsonwebtoken');
		const userId = (jwt.decode(token) as { sub: string }).sub;
		await GoogleConnectionModel.create({
			userId,
			googleSubject: 'sub-1',
			email: 'user@example.com',
			refreshToken: 'segredo-nunca-exposto',
			scopes: [],
			calendarId: 'cal-1',
		});

		const res = await request(app).get('/api/v1/integrations/google/status').set(authHeader);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			connected: true,
			email: 'user@example.com',
			calendarConfigured: true,
			spreadsheetConfigured: false,
		});
		const raw = JSON.stringify(res.body);
		expect(raw).not.toMatch(/refreshToken|segredo|accessToken|client_secret/i);
	});

	it('google status de outro tenant não vaza (404 lógico → connected false)', async () => {
		const tokenA = await loginAs(app, 'a@example.com');
		await loginAs(app, 'b@example.com');
		const { default: jwt } = await import('jsonwebtoken');
		const userIdA = (jwt.decode(tokenA) as { sub: string }).sub;
		await GoogleConnectionModel.create({
			userId: userIdA,
			googleSubject: 'sub-a',
			email: 'a@example.com',
			refreshToken: 'segredo-a',
			scopes: [],
		});

		const tokenB = await loginAs(app, 'c@example.com');
		const res = await request(app)
			.get('/api/v1/integrations/google/status')
			.set(bearer(tokenB));
		expect(res.body).toEqual({ connected: false });
	});
});
