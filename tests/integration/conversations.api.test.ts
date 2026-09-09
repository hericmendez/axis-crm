import { afterAll, beforeEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import { createApp } from '../../src/app.js';
import { bearer, loginAs } from './auth-helper.js';
import * as conversaService from '../../src/services/conversa.service.js';
import * as leadService from '../../src/services/lead.service.js';

function subOf(token: string): string {
	const payload = jwt.decode(token) as { sub: string } | null;
	if (!payload?.sub) throw new Error('token sem sub');
	return payload.sub;
}

describe('API /api/v1/conversations', () => {
	const app = createApp();

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

	async function auth(email = 'user@example.com') {
		const token = await loginAs(app, email);
		return { header: bearer(token), userId: subOf(token) };
	}

	async function criarConversa(userId: string, chatId: string, leadId?: string) {
		const conversa = await conversaService.getOrCreate(userId, 'whatsapp', chatId);
		await conversaService.appendMessage(userId, conversa.id, { papel: 'usuario', conteudo: 'olá' });
		if (leadId) {
			await conversaService.associateLead(userId, conversa.id, leadId);
		}
		return conversa;
	}

	it('sem identidade retorna 401', async () => {
		expect((await request(app).get('/api/v1/conversations')).status).toBe(401);
		expect((await request(app).get('/api/v1/conversations/507f1f77bcf86cd799439011')).status).toBe(401);
	});

	it('lista somente conversas do tenant com paginação', async () => {
		const a = await auth('a@example.com');
		const b = await auth('b@example.com');
		await criarConversa(a.userId, 'chat-a1@c.us');
		await criarConversa(a.userId, 'chat-a2@c.us');
		await criarConversa(b.userId, 'chat-b1@c.us');

		const res = await request(app).get('/api/v1/conversations').set(a.header);
		expect(res.status).toBe(200);
		expect(res.body.total).toBe(2);
		expect(res.body.items).toHaveLength(2);

		const page = await request(app).get('/api/v1/conversations?page=2&limit=1').set(a.header);
		expect(page.body.total).toBe(2);
		expect(page.body.items).toHaveLength(1);
	});

	it('filtra por leadId e canal', async () => {
		const a = await auth();
		const lead = await leadService.create(a.userId, {
			nome: 'João',
			telefone: '11999990001',
			contatoOrigem: 'w',
		});
		await criarConversa(a.userId, 'chat-1@c.us', lead.id);
		await criarConversa(a.userId, 'chat-2@c.us');

		const porLead = await request(app)
			.get(`/api/v1/conversations?leadId=${lead.id}`)
			.set(a.header);
		expect(porLead.body.total).toBe(1);

		const porCanal = await request(app).get('/api/v1/conversations?canal=whatsapp').set(a.header);
		expect(porCanal.body.total).toBe(2);
	});

	it('detalhe expõe mensagens, lead e summary sem vazar segredos', async () => {
		const a = await auth();
		const lead = await leadService.create(a.userId, {
			nome: 'João',
			telefone: '11999990001',
			contatoOrigem: 'w',
		});
		const conversa = await criarConversa(a.userId, 'chat-1@c.us', lead.id);

		const res = await request(app).get(`/api/v1/conversations/${conversa.id}`).set(a.header);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({
			id: conversa.id,
			canal: 'whatsapp',
			chatIdExterno: 'chat-1@c.us',
			leadId: lead.id,
		});
		expect(res.body.mensagens).toHaveLength(1);
		const raw = JSON.stringify(res.body);
		expect(raw).not.toMatch(/passwordHash|refreshToken|apiKey/i);
	});

	it('detalhe limita mensagens (bound 50 default, cap 200)', async () => {
		const a = await auth();
		const conversa = await conversaService.getOrCreate(a.userId, 'whatsapp', 'chat-long@c.us');
		for (let i = 0; i < 60; i++) {
			await conversaService.appendMessage(a.userId, conversa.id, { papel: 'usuario', conteudo: `m${i}` });
		}

		const def = await request(app).get(`/api/v1/conversations/${conversa.id}`).set(a.header);
		expect(def.body.mensagens).toHaveLength(50);

		const capped = await request(app)
			.get(`/api/v1/conversations/${conversa.id}?limit=500`)
			.set(a.header);
		// limit > 200 é rejeitado pela validação
		expect(capped.status).toBe(400);
	});

	it('cross-tenant retorna 404 e id malformado retorna 400/404 controlado', async () => {
		const a = await auth('a@example.com');
		const b = await auth('b@example.com');
		const conversa = await criarConversa(a.userId, 'chat-a@c.us');

		expect((await request(app).get(`/api/v1/conversations/${conversa.id}`).set(b.header)).status).toBe(404);
		expect((await request(app).get('/api/v1/conversations/id-invalido').set(a.header)).status).toBe(400);
		expect(
			(await request(app).get('/api/v1/conversations/507f1f77bcf86cd799439011').set(a.header)).status,
		).toBe(404);
	});

	it('query inválida retorna 400', async () => {
		const a = await auth();
		expect((await request(app).get('/api/v1/conversations?page=0').set(a.header)).status).toBe(400);
		expect((await request(app).get('/api/v1/conversations?canal=sms').set(a.header)).status).toBe(400);
	});
});
