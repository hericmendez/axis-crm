import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import { createApp } from '../../src/app.js';
import { bearer, loginAs } from './auth-helper.js';

vi.mock('../../src/repositories/lead.repository.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/repositories/lead.repository.js')>();
	return { ...actual };
});

const baseLead = {
	nome: 'Ana',
	telefone: '11977776666',
	contatoOrigem: 'meta_ads',
};

describe('API de eventos, agenda e métricas', () => {
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

	afterEach(async () => {
		vi.restoreAllMocks();
	});

	async function auth() {
		return bearer(await loginAs(app));
	}

	async function criarLead(authHeader: { Authorization: string }) {
		const res = await request(app).post('/api/leads').set(authHeader).send(baseLead);
		expect(res.status).toBe(201);
		return res.body.id as string;
	}

	it('sem identidade retorna 401', async () => {
		expect((await request(app).get('/api/metricas?de=2026-01-01T00:00:00Z&ate=2027-01-01T00:00:00Z')).status).toBe(401);
		expect((await request(app).get('/api/agenda?de=2026-01-01T00:00:00Z&ate=2027-01-01T00:00:00Z')).status).toBe(401);
	});

	it('POST /api/leads/:id/eventos cria evento e aplica efeito no lead', async () => {
		const authHeader = await auth();
		const leadId = await criarLead(authHeader);
		const res = await request(app)
			.post(`/api/leads/${leadId}/eventos`)
			.set(authHeader)
			.send({ tipo: 'AGENDAMENTO', data: '2026-09-01T10:00:00Z' });
		expect(res.status).toBe(201);
		expect(res.body.tipo).toBe('AGENDAMENTO');

		const leadRes = await request(app).get(`/api/leads/${leadId}`).set(authHeader);
		expect(leadRes.body.dataAgendamento).toBe('2026-09-01T10:00:00.000Z');
	});

	it('POST com tipo NENHUM retorna 400', async () => {
		const authHeader = await auth();
		const leadId = await criarLead(authHeader);
		const res = await request(app)
			.post(`/api/leads/${leadId}/eventos`)
			.set(authHeader)
			.send({ tipo: 'NENHUM' });
		expect(res.status).toBe(400);
	});

	it('GET /api/leads/:id/eventos lista histórico ordenado', async () => {
		const authHeader = await auth();
		const leadId = await criarLead(authHeader);
		await request(app)
			.post(`/api/leads/${leadId}/eventos`)
			.set(authHeader)
			.send({ tipo: 'AGENDAMENTO', data: '2026-09-01T10:00:00Z' });
		await request(app)
			.post(`/api/leads/${leadId}/eventos`)
			.set(authHeader)
			.send({ tipo: 'VENDA', data: '2026-09-03T12:00:00Z' });

		const res = await request(app).get(`/api/leads/${leadId}/eventos`).set(authHeader);
		expect(res.status).toBe(200);
		expect(res.body).toHaveLength(2);
		expect(res.body.map((e: { tipo: string }) => e.tipo)).toEqual(['AGENDAMENTO', 'VENDA']);
	});

	it('evento de outro tenant é invisível (404) e não lista', async () => {
		const authA = bearer(await loginAs(app, 'a@example.com'));
		const authB = bearer(await loginAs(app, 'b@example.com'));
		const leadId = await criarLead(authA);
		await request(app)
			.post(`/api/leads/${leadId}/eventos`)
			.set(authA)
			.send({ tipo: 'VENDA', data: '2026-09-03T12:00:00Z' });

		expect((await request(app).get(`/api/leads/${leadId}/eventos`).set(authB)).status).toBe(404);
		expect(
			(await request(app).post(`/api/leads/${leadId}/eventos`).set(authB).send({ tipo: 'VENDA' })).status,
		).toBe(404);
	});

	it('GET /api/metricas exige de e ate', async () => {
		const authHeader = await auth();
		const res = await request(app).get('/api/metricas').set(authHeader);
		expect(res.status).toBe(400);
	});

	it('GET /api/metricas agrega as três métricas', async () => {
		const authHeader = await auth();
		const leadId = await criarLead(authHeader);
		await request(app).post(`/api/leads/${leadId}/eventos`).set(authHeader).send({ tipo: 'VENDA' });

		const res = await request(app).get(
			'/api/metricas?de=2026-01-01T00:00:00Z&ate=2027-01-01T00:00:00Z',
		).set(authHeader);
		expect(res.status).toBe(200);
		expect(res.body.leadsPorStatus.length).toBeGreaterThan(0);
		expect(res.body.eventosPorTipo[0]).toMatchObject({ tipo: 'VENDA', total: 1 });
		expect(res.body.taxaConversao.taxaConversao).toBeCloseTo(1);
	});

	it('métricas são isoladas por tenant', async () => {
		const authA = bearer(await loginAs(app, 'a@example.com'));
		const authB = bearer(await loginAs(app, 'b@example.com'));
		const leadId = await criarLead(authA);
		await request(app).post(`/api/leads/${leadId}/eventos`).set(authA).send({ tipo: 'VENDA' });

		const resB = await request(app).get(
			'/api/metricas?de=2026-01-01T00:00:00Z&ate=2027-01-01T00:00:00Z',
		).set(authB);
		expect(resB.status).toBe(200);
		expect(resB.body.leadsPorStatus).toEqual([]);
		expect(resB.body.taxaConversao.taxaConversao).toBe(0);
	});

	it('GET /api/agenda valida intervalo e retorna itens', async () => {
		const authHeader = await auth();
		const resInvalido = await request(app).get(
			'/api/agenda?de=2026-09-02T00:00:00Z&ate=2026-09-01T00:00:00Z',
		).set(authHeader);
		expect(resInvalido.status).toBe(400);

		const leadId = await criarLead(authHeader);
		await request(app)
			.post(`/api/leads/${leadId}/eventos`)
			.set(authHeader)
			.send({ tipo: 'AGENDAMENTO', data: '2026-09-01T10:00:00Z' });

		const res = await request(app).get(
			'/api/agenda?de=2026-09-01T00:00:00Z&ate=2026-09-02T00:00:00Z',
		).set(authHeader);
		expect(res.status).toBe(200);
		expect(res.body).toHaveLength(1);
		expect(res.body[0].leadId).toBe(leadId);
	});

	it('agenda é isolada por tenant', async () => {
		const authA = bearer(await loginAs(app, 'a@example.com'));
		const authB = bearer(await loginAs(app, 'b@example.com'));
		const leadId = await criarLead(authA);
		await request(app)
			.post(`/api/leads/${leadId}/eventos`)
			.set(authA)
			.send({ tipo: 'AGENDAMENTO', data: '2026-09-01T10:00:00Z' });

		const resB = await request(app).get(
			'/api/agenda?de=2026-09-01T00:00:00Z&ate=2026-09-02T00:00:00Z',
		).set(authB);
		expect(resB.status).toBe(200);
		expect(resB.body).toEqual([]);
	});

	async function criarAgendamento(authHeader: { Authorization: string }, leadId: string, data: string) {
		const res = await request(app)
			.post(`/api/leads/${leadId}/eventos`)
			.set(authHeader)
			.send({ tipo: 'AGENDAMENTO', data });
		expect(res.status).toBe(201);
		return res.body.id as string;
	}

	it('GET /api/leads/:id/eventos/:eventoId retorna o evento', async () => {
		const authHeader = await auth();
		const leadId = await criarLead(authHeader);
		const eventoId = await criarAgendamento(authHeader, leadId, '2026-09-01T10:00:00Z');

		const res = await request(app).get(`/api/leads/${leadId}/eventos/${eventoId}`).set(authHeader);
		expect(res.status).toBe(200);
		expect(res.body).toMatchObject({ id: eventoId, leadId, tipo: 'AGENDAMENTO' });
	});

	it('GET evento de outro tenant ou lead divergente retorna 404', async () => {
		const authA = bearer(await loginAs(app, 'a@example.com'));
		const authB = bearer(await loginAs(app, 'b@example.com'));
		const leadA = await criarLead(authA);
		const eventoId = await criarAgendamento(authA, leadA, '2026-09-01T10:00:00Z');

		expect((await request(app).get(`/api/leads/${leadA}/eventos/${eventoId}`).set(authB)).status).toBe(404);

		const leadBRes = await request(app).post('/api/leads').set(authB).send({
			nome: 'Beto',
			telefone: '11988887777',
			contatoOrigem: 'meta_ads',
		});
		const leadB = leadBRes.body.id as string;
		expect((await request(app).get(`/api/leads/${leadB}/eventos/${eventoId}`).set(authA)).status).toBe(404);
		expect((await request(app).get(`/api/leads/${leadA}/eventos/id-invalido`).set(authA)).status).toBe(400);
	});

	it('POST DESISTENCIA com eventoId cancela o alvo explícito (previousEventoId)', async () => {
		const authHeader = await auth();
		const leadId = await criarLead(authHeader);
		const eventoId = await criarAgendamento(authHeader, leadId, '2026-09-01T10:00:00Z');

		const res = await request(app)
			.post(`/api/leads/${leadId}/eventos`)
			.set(authHeader)
			.send({ tipo: 'DESISTENCIA', eventoId });
		expect(res.status).toBe(201);
		expect(res.body).toMatchObject({ tipo: 'DESISTENCIA', previousEventoId: eventoId });
	});

	it('POST REAGENDAMENTO com eventoId + data cria sucessor encadeado', async () => {
		const authHeader = await auth();
		const leadId = await criarLead(authHeader);
		const eventoId = await criarAgendamento(authHeader, leadId, '2026-09-01T10:00:00Z');

		const res = await request(app)
			.post(`/api/leads/${leadId}/eventos`)
			.set(authHeader)
			.send({ tipo: 'REAGENDAMENTO', data: '2026-09-05T14:00:00Z', eventoId });
		expect(res.status).toBe(201);
		expect(res.body).toMatchObject({ tipo: 'REAGENDAMENTO', previousEventoId: eventoId });

		const historico = await request(app).get(`/api/leads/${leadId}/eventos`).set(authHeader);
		expect(historico.body).toHaveLength(2);
	});

	it('eventoId inválido, de outro tenant ou já resolvido retorna erro sem mutação', async () => {
		const authHeader = await auth();
		const leadId = await criarLead(authHeader);
		const eventoId = await criarAgendamento(authHeader, leadId, '2026-09-01T10:00:00Z');

		const antes = await request(app).get(`/api/leads/${leadId}/eventos`).set(authHeader);
		expect(antes.body).toHaveLength(1);

		// eventoId inexistente
		expect(
			(
				await request(app)
					.post(`/api/leads/${leadId}/eventos`)
					.set(authHeader)
					.send({ tipo: 'DESISTENCIA', eventoId: '507f1f77bcf86cd799439099' })
			).status,
		).toBe(404);

		// eventoId com tipo que não aceita alvo explícito
		expect(
			(
				await request(app)
					.post(`/api/leads/${leadId}/eventos`)
					.set(authHeader)
					.send({ tipo: 'AGENDAMENTO', eventoId })
			).status,
		).toBe(400);

		// cancela, depois tenta cancelar de novo o mesmo alvo
		expect(
			(
				await request(app)
					.post(`/api/leads/${leadId}/eventos`)
					.set(authHeader)
					.send({ tipo: 'DESISTENCIA', eventoId })
			).status,
		).toBe(201);
		expect(
			(
				await request(app)
					.post(`/api/leads/${leadId}/eventos`)
					.set(authHeader)
					.send({ tipo: 'DESISTENCIA', eventoId })
			).status,
		).toBe(404);

		const depois = await request(app).get(`/api/leads/${leadId}/eventos`).set(authHeader);
		expect(depois.body).toHaveLength(2);
	});
});
