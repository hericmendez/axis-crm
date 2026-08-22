import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import { createApp } from '../../src/app.js';

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
	it('POST cria lead com 201 e telefone normalizado', async () => {
		const res = await request(createApp()).post('/api/leads').send(baseLead);
		expect(res.status).toBe(201);
		expect(res.body.telefone).toBe('11912345678');
		expect(res.body.status).toBeUndefined();
	});

	it('POST com body inválido retorna 400', async () => {
		const res = await request(createApp()).post('/api/leads').send({ nome: 'João' });
		expect(res.status).toBe(400);
		expect(typeof res.body.error).toBe('string');
	});

	it('POST duplicado retorna 409', async () => {
		const app = createApp();
		await request(app).post('/api/leads').send(baseLead);
		const res = await request(app).post('/api/leads').send(baseLead);
		expect(res.status).toBe(409);
	});

	it('ciclo completo: cria → lista → detalhe → patch → delete → 404', async () => {
		const app = createApp();
		const created = await request(app).post('/api/leads').send(baseLead);
		const id = created.body.id as string;

		const listRes = await request(app).get('/api/leads');
		expect(listRes.status).toBe(200);
		expect(listRes.body.total).toBe(1);
		expect(listRes.body.page).toBe(1);
		expect(listRes.body.items).toHaveLength(1);

		const getRes = await request(app).get(`/api/leads/${id}`);
		expect(getRes.status).toBe(200);

		const patchRes = await request(app)
			.patch(`/api/leads/${id}`)
			.send({ status: 'AGENDADO', dataAgendamento: '2026-09-01T10:00:00Z' });
		expect(patchRes.status).toBe(200);
		expect(patchRes.body.status).toBe('AGENDADO');

		const delRes = await request(app).delete(`/api/leads/${id}`);
		expect(delRes.status).toBe(204);

		const notFound = await request(app).get(`/api/leads/${id}`);
		expect(notFound.status).toBe(404);
	});

	it('GET id inexistente retorna 404', async () => {
		const res = await request(createApp()).get('/api/leads/507f1f77bcf86cd799439011');
		expect(res.status).toBe(404);
	});

	it('id malformado produz erro controlado (404) em GET/PATCH/DELETE', async () => {
		const app = createApp();
		expect((await request(app).get('/api/leads/id-invalido')).status).toBe(404);
		expect((await request(app).patch('/api/leads/id-invalido').send({ nome: 'x' })).status).toBe(404);
		expect((await request(app).delete('/api/leads/id-invalido')).status).toBe(404);
	});

	it('PATCH vazio retorna 400', async () => {
		const created = await request(createApp()).post('/api/leads').send(baseLead);
		const res = await request(createApp())
			.patch(`/api/leads/${created.body.id}`)
			.send({});
		expect(res.status).toBe(400);
	});
});
