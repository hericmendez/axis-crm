import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import { createApp } from '../../src/app.js';
import { bearer, loginAs } from './auth-helper.js';

const RANGE = '/api/v1/agenda?de=2026-09-10T00:00:00-03:00&ate=2026-09-11T00:00:00-03:00';

describe('API /api/v1/agenda', () => {
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
		return bearer(await loginAs(app, email));
	}

	async function criarAgendamento(authHeader: { Authorization: string }, data: string) {
		const lead = await request(app)
			.post('/api/leads')
			.set(authHeader)
			.send({ nome: 'João', telefone: '11999990001', contatoOrigem: 'w' });
		expect(lead.status).toBe(201);
		const evento = await request(app)
			.post(`/api/leads/${lead.body.id}/eventos`)
			.set(authHeader)
			.send({ tipo: 'AGENDAMENTO', data });
		expect(evento.status).toBe(201);
		return { leadId: lead.body.id as string, eventoId: evento.body.id as string };
	}

	it('sem identidade retorna 401', async () => {
		expect((await request(app).get(RANGE)).status).toBe(401);
	});

	it('agenda vazia retorna view com disponibilidade total e calendarStatus', async () => {
		const authHeader = await auth();
		const res = await request(app).get(RANGE).set(authHeader);
		expect(res.status).toBe(200);
		expect(res.body.eventos).toEqual([]);
		expect(res.body.ocupacao).toEqual([]);
		expect(res.body.disponibilidade).toHaveLength(1);
		expect(typeof res.body.calendarStatus).toBe('string');
	});

	it('retorna eventos do tenant com ocupação e disponibilidade', async () => {
		const authHeader = await auth();
		await criarAgendamento(authHeader, '2026-09-10T10:00:00-03:00');

		const res = await request(app).get(RANGE).set(authHeader);
		expect(res.status).toBe(200);
		expect(res.body.eventos).toHaveLength(1);
		expect(res.body.eventos[0]).toMatchObject({ origem: 'domain', allDay: false });
		expect(res.body.ocupacao).toHaveLength(1);
		expect(res.body.disponibilidade).toHaveLength(2);
		expect(new Date(res.body.de).getTime()).toBeLessThan(new Date(res.body.ate).getTime());
	});

	it('isolamento: tenant B não vê eventos do tenant A', async () => {
		const authA = await auth('a@example.com');
		const authB = bearer(await loginAs(app, 'b@example.com'));
		await criarAgendamento(authA, '2026-09-10T10:00:00-03:00');

		const resB = await request(app).get(RANGE).set(authB);
		expect(resB.status).toBe(200);
		expect(resB.body.eventos).toEqual([]);
		expect(resB.body.disponibilidade).toHaveLength(1);
	});

	it('intervalo inválido retorna 400', async () => {
		const authHeader = await auth();
		const res = await request(app)
			.get('/api/v1/agenda?de=2026-09-11T00:00:00-03:00&ate=2026-09-10T00:00:00-03:00')
			.set(authHeader);
		expect(res.status).toBe(400);
	});

	it('sem parâmetros usa defaults (agora → +7 dias)', async () => {
		const authHeader = await auth();
		const res = await request(app).get('/api/v1/agenda').set(authHeader);
		expect(res.status).toBe(200);
		expect(res.body.eventos).toEqual([]);
		const diffDias = (new Date(res.body.ate).getTime() - new Date(res.body.de).getTime()) / 86400000;
		expect(diffDias).toBeCloseTo(7, 0);
	});
});
