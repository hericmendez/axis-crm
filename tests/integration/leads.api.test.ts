import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import { createApp } from '../../src/app.js';
import { bearer, loginAs } from './auth-helper.js';

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

const baseLead = {
	nome: 'João',
	telefone: '(11) 91234-5678',
	contatoOrigem: 'instagram',
};

describe('API /api/leads', () => {
	it('sem identidade retorna 401', async () => {
		const app = createApp();
		expect((await request(app).get('/api/leads')).status).toBe(401);
		expect((await request(app).post('/api/leads').send(baseLead)).status).toBe(401);
	});

	it('POST cria lead com 201 e telefone normalizado', async () => {
		const app = createApp();
		const auth = bearer(await loginAs(app));
		const res = await request(app).post('/api/leads').set(auth).send(baseLead);
		expect(res.status).toBe(201);
		expect(res.body.telefone).toBe('11912345678');
		expect(res.body.status).toBeUndefined();
		expect(res.body.userId).toBeDefined();
	});

	it('POST com body inválido retorna 400', async () => {
		const app = createApp();
		const auth = bearer(await loginAs(app));
		const res = await request(app).post('/api/leads').set(auth).send({ nome: 'João' });
		expect(res.status).toBe(400);
		expect(typeof res.body.error).toBe('string');
	});

	it('POST duplicado retorna 409', async () => {
		const app = createApp();
		const auth = bearer(await loginAs(app));
		await request(app).post('/api/leads').set(auth).send(baseLead);
		const res = await request(app).post('/api/leads').set(auth).send(baseLead);
		expect(res.status).toBe(409);
	});

	it('ciclo completo: cria → lista → detalhe → patch → delete → 404', async () => {
		const app = createApp();
		const auth = bearer(await loginAs(app));
		const created = await request(app).post('/api/leads').set(auth).send(baseLead);
		const id = created.body.id as string;

		const listRes = await request(app).get('/api/leads').set(auth);
		expect(listRes.status).toBe(200);
		expect(listRes.body.total).toBe(1);
		expect(listRes.body.page).toBe(1);
		expect(listRes.body.items).toHaveLength(1);

		const getRes = await request(app).get(`/api/leads/${id}`).set(auth);
		expect(getRes.status).toBe(200);

		const patchRes = await request(app)
			.patch(`/api/leads/${id}`)
			.set(auth)
			.send({ status: 'AGENDADO', dataAgendamento: '2026-09-01T10:00:00Z' });
		expect(patchRes.status).toBe(200);
		expect(patchRes.body.status).toBe('AGENDADO');

		const delRes = await request(app).delete(`/api/leads/${id}`).set(auth);
		expect(delRes.status).toBe(204);

		const notFound = await request(app).get(`/api/leads/${id}`).set(auth);
		expect(notFound.status).toBe(404);
	});

	it('GET id inexistente retorna 404', async () => {
		const app = createApp();
		const auth = bearer(await loginAs(app));
		const res = await request(app).get('/api/leads/507f1f77bcf86cd799439011').set(auth);
		expect(res.status).toBe(404);
	});

	it('id malformado produz erro controlado (404) em GET/PATCH/DELETE', async () => {
		const app = createApp();
		const auth = bearer(await loginAs(app));
		expect((await request(app).get('/api/leads/id-invalido').set(auth)).status).toBe(404);
		expect((await request(app).patch('/api/leads/id-invalido').set(auth).send({ nome: 'x' })).status).toBe(404);
		expect((await request(app).delete('/api/leads/id-invalido').set(auth)).status).toBe(404);
	});

	it('PATCH vazio retorna 400', async () => {
		const app = createApp();
		const auth = bearer(await loginAs(app));
		const created = await request(app).post('/api/leads').set(auth).send(baseLead);
		const res = await request(app)
			.patch(`/api/leads/${created.body.id}`)
			.set(auth)
			.send({});
		expect(res.status).toBe(400);
	});

	it('userId no body é ignorado: ownership vem da autenticação', async () => {
		const app = createApp();
		const token = await loginAs(app);
		const res = await request(app)
			.post('/api/leads')
			.set(bearer(token))
			.send({ ...baseLead, userId: '507f1f77bcf86cd799439099' });
		expect(res.status).toBe(201);
		expect(res.body.userId).not.toBe('507f1f77bcf86cd799439099');
	});

	it('tenant B não enxerga leads do tenant A (GET/PATCH/DELETE → 404, LIST isolada)', async () => {
		const app = createApp();
		const authA = bearer(await loginAs(app, 'a@example.com'));
		const authB = bearer(await loginAs(app, 'b@example.com'));

		const created = await request(app).post('/api/leads').set(authA).send(baseLead);
		expect(created.status).toBe(201);
		const id = created.body.id as string;

		expect((await request(app).get(`/api/leads/${id}`).set(authB)).status).toBe(404);
		expect((await request(app).patch(`/api/leads/${id}`).set(authB).send({ nome: 'X' })).status).toBe(404);
		expect((await request(app).delete(`/api/leads/${id}`).set(authB)).status).toBe(404);

		const listB = await request(app).get('/api/leads').set(authB);
		expect(listB.status).toBe(200);
		expect(listB.body.total).toBe(0);

		const listA = await request(app).get('/api/leads').set(authA);
		expect(listA.body.total).toBe(1);
	});

	it('filtra por telefone (normalizado) e nome (exato, case-insensitive)', async () => {
		const app = createApp();
		const auth = bearer(await loginAs(app));
		await request(app).post('/api/leads').set(auth).send(baseLead);
		await request(app).post('/api/leads').set(auth).send({
			nome: 'Maria',
			telefone: '11988887777',
			contatoOrigem: 'instagram',
		});

		const porTelefone = await request(app).get('/api/leads?telefone=(11) 91234-5678').set(auth);
		expect(porTelefone.body.total).toBe(1);
		expect(porTelefone.body.items[0].nome).toBe('João');

		const porNome = await request(app).get('/api/leads?nome=maria').set(auth);
		expect(porNome.body.total).toBe(1);

		const semMatch = await request(app).get('/api/leads?nome=inexistente').set(auth);
		expect(semMatch.body.total).toBe(0);

		expect((await request(app).get('/api/leads?telefone=abc').set(auth)).status).toBe(400);
	});
});
