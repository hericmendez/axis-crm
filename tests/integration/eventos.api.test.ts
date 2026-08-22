import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import { createApp } from '../../src/app.js';
import * as leadService from '../../src/services/lead.service.js';

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

	it('POST /api/leads/:id/eventos cria evento e aplica efeito no lead', async () => {
		const lead = await leadService.create(baseLead);
		const res = await request(app)
			.post(`/api/leads/${lead.id}/eventos`)
			.send({ tipo: 'AGENDAMENTO', data: '2026-09-01T10:00:00Z' });
		expect(res.status).toBe(201);
		expect(res.body.tipo).toBe('AGENDAMENTO');

		const leadRes = await request(app).get(`/api/leads/${lead.id}`);
		expect(leadRes.body.dataAgendamento).toBe('2026-09-01T10:00:00.000Z');
	});

	it('POST com tipo NENHUM retorna 400', async () => {
		const lead = await leadService.create(baseLead);
		const res = await request(app)
			.post(`/api/leads/${lead.id}/eventos`)
			.send({ tipo: 'NENHUM' });
		expect(res.status).toBe(400);
	});

	it('GET /api/leads/:id/eventos lista histórico ordenado', async () => {
		const lead = await leadService.create(baseLead);
		await request(app).post(`/api/leads/${lead.id}/eventos`).send({ tipo: 'AGENDAMENTO' });
		await request(app)
			.post(`/api/leads/${lead.id}/eventos`)
			.send({ tipo: 'VENDA', data: '2026-09-03T12:00:00Z' });

		const res = await request(app).get(`/api/leads/${lead.id}/eventos`);
		expect(res.status).toBe(200);
		expect(res.body).toHaveLength(2);
		expect(res.body.map((e: { tipo: string }) => e.tipo)).toEqual(['AGENDAMENTO', 'VENDA']);
	});

	it('GET /api/metricas exige de e ate', async () => {
		const res = await request(app).get('/api/metricas');
		expect(res.status).toBe(400);
	});

	it('GET /api/metricas agrega as três métricas', async () => {
		const lead = await leadService.create(baseLead);
		await request(app).post(`/api/leads/${lead.id}/eventos`).send({ tipo: 'VENDA' });

		const res = await request(app).get(
			'/api/metricas?de=2026-01-01T00:00:00Z&ate=2027-01-01T00:00:00Z',
		);
		expect(res.status).toBe(200);
		expect(res.body.leadsPorStatus.length).toBeGreaterThan(0);
		expect(res.body.eventosPorTipo[0]).toMatchObject({ tipo: 'VENDA', total: 1 });
		expect(res.body.taxaConversao.taxaConversao).toBeCloseTo(1);
	});

	it('GET /api/agenda valida intervalo e retorna itens', async () => {
		const resInvalido = await request(app).get(
			'/api/agenda?de=2026-09-02T00:00:00Z&ate=2026-09-01T00:00:00Z',
		);
		expect(resInvalido.status).toBe(400);

		const lead = await leadService.create(baseLead);
		await request(app)
			.post(`/api/leads/${lead.id}/eventos`)
			.send({ tipo: 'AGENDAMENTO', data: '2026-09-01T10:00:00Z' });

		const res = await request(app).get(
			'/api/agenda?de=2026-09-01T00:00:00Z&ate=2026-09-02T00:00:00Z',
		);
		expect(res.status).toBe(200);
		expect(res.body).toHaveLength(1);
		expect(res.body[0].leadId).toBe(lead.id);
	});
});
