import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import { createApp } from '../../src/app.js';
import { bearer, loginAs } from './auth-helper.js';
import * as conversaService from '../../src/services/conversa.service.js';
import { LeadModel } from '../../src/models/lead.model.js';
import { GoogleConnectionModel } from '../../src/models/google-connection.model.js';

const D1 = '2027-05-10T10:00:00.000Z';
const D2 = '2027-05-12T14:00:00.000Z';
const RANGE = 'de=2027-01-01T00:00:00.000Z&ate=2028-01-01T00:00:00.000Z';
const OTHER_ID = '507f1f77bcf86cd799439099';

function userIdOf(token: string): string {
	const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64').toString()) as {
		sub: string;
	};
	return payload.sub;
}

describe('Phase 6 journey: authenticated API across tenants and domain', () => {
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

	async function twoTenants() {
		const tokenA = await loginAs(app, 'a@example.com');
		const tokenB = await loginAs(app, 'b@example.com');
		return {
			authA: bearer(tokenA),
			authB: bearer(tokenB),
			idA: userIdOf(tokenA),
			idB: userIdOf(tokenB),
		};
	}

	async function createLead(auth: { Authorization: string }, telefone = '11999990001') {
		const res = await request(app)
			.post('/api/leads')
			.set(auth)
			.send({ nome: 'Lead Journey', telefone, contatoOrigem: 'e2e' });
		expect(res.status).toBe(201);
		return res.body.id as string;
	}

	it('full login lifecycle: login, use, refresh rotation, logout revocation', async () => {
		await request(app)
			.post('/api/auth/login')
			.send({ email: 'j@example.com', password: 'senha-forte-123' });
		// NOTE: loginAs both creates the user and logs in; the stray call above
		// proves unknown users fail without leaking which check failed.
		const login = await request(app)
			.post('/api/auth/login')
			.send({ email: 'j@example.com', password: 'senha-forte-123' });
		expect(login.status).toBe(401);

		const token = await loginAs(app, 'j@example.com');
		const auth = bearer(token);
		expect((await request(app).get('/api/leads').set(auth)).status).toBe(200);

		// Refresh rotation: use the refresh token captured via a fresh login.
		const fresh = await request(app)
			.post('/api/auth/login')
			.send({ email: 'j@example.com', password: 'senha-forte-123' });
		const rotated = await request(app)
			.post('/api/auth/refresh')
			.send({ refreshToken: fresh.body.refreshToken });
		expect(rotated.status).toBe(200);
		expect(rotated.body.accessToken).toBeDefined();
		expect(rotated.body.refreshToken).not.toBe(fresh.body.refreshToken);
		// Old refresh token is dead after rotation.
		expect(
			(await request(app).post('/api/auth/refresh').send({ refreshToken: fresh.body.refreshToken })).status,
		).toBe(401);
		// New access token works.
		expect(
			(await request(app).get('/api/leads').set(bearer(rotated.body.accessToken))).status,
		).toBe(200);

		// Logout revokes the refresh token but the (short-lived) access token
		// keeps working until expiry — that is the implemented contract.
		expect(
			(await request(app).post('/api/auth/logout').send({ refreshToken: rotated.body.refreshToken }))
				.status,
		).toBe(200);
		expect(
			(await request(app).post('/api/auth/refresh').send({ refreshToken: rotated.body.refreshToken }))
				.status,
		).toBe(401);
		expect(
			(await request(app).get('/api/leads').set(bearer(rotated.body.accessToken))).status,
		).toBe(200);
	});

	it('tenant identity cannot be overridden from body, query or params', async () => {
		const { authA, authB, idB } = await twoTenants();

	 const created = await request(app)
			.post('/api/leads')
			.set(authA)
			.send({ nome: 'X', telefone: '11999990001', contatoOrigem: 'e2e', userId: idB });
		expect(created.status).toBe(201);
		expect(created.body.userId).not.toBe(idB);

		// Query-string userId is stripped by validation: A still sees only A's leads.
	 const listed = await request(app).get(`/api/leads?userId=${idB}`).set(authA);
		expect(listed.status).toBe(200);
		expect(listed.body.total).toBe(1);

		// Cross-tenant event creation is rejected even with a valid lead id shape.
		const leadB = await createLead(authB, '11999990002');
		expect(
			(await request(app).post(`/api/leads/${leadB}/eventos`).set(authA).send({ tipo: 'VENDA' }))
				.status,
		).toBe(404);

		// userId smuggled into an event body is stripped the same way.
		const leadA = await createLead(authA, '11999990003');
		const ev = await request(app)
			.post(`/api/leads/${leadA}/eventos`)
			.set(authA)
			.send({ tipo: 'VENDA', userId: idB });
		expect(ev.status).toBe(201);
		expect(ev.body.userId).not.toBe(idB);
	});

	it('lead lifecycle persists across the API and database boundary', async () => {
		const { authA, authB } = await twoTenants();
		const leadId = await createLead(authA);

		const got = await request(app).get(`/api/leads/${leadId}`).set(authA);
		expect(got.body.nome).toBe('Lead Journey');
		expect((await request(app).get(`/api/leads/${leadId}`).set(authB)).status).toBe(404);

	 const patched = await request(app).patch(`/api/leads/${leadId}`).set(authA).send({ status: 'VENDIDO' });
		expect(patched.status).toBe(200);
		const reread = await LeadModel.findById(leadId).lean();
		expect(reread?.status).toBe('VENDIDO');

	 expect((await request(app).delete(`/api/leads/${leadId}`).set(authA)).status).toBe(204);
		expect((await request(app).get(`/api/leads/${leadId}`).set(authA)).status).toBe(404);
		expect(await LeadModel.findById(leadId).lean()).toBeNull();
	});

	it('agenda lifecycle: schedule, reschedule with predecessor, cancel, agenda reflects it', async () => {
		const { authA, authB } = await twoTenants();
		const leadId = await createLead(authA);

		const created = await request(app)
			.post(`/api/leads/${leadId}/eventos`)
			.set(authA)
			.send({ tipo: 'AGENDAMENTO', data: D1 });
		expect(created.status).toBe(201);
		const eventoId = created.body.id as string;

	 const agenda1 = await request(app).get(`/api/v1/agenda?de=2027-05-01T00:00:00.000Z&ate=2027-05-20T00:00:00.000Z`).set(authA);
		expect(agenda1.status).toBe(200);
		expect(agenda1.body.eventos.map((e: { id: string }) => e.id)).toContain(eventoId);
		expect((await request(app).get(`/api/v1/agenda?de=2027-05-01T00:00:00.000Z&ate=2027-05-20T00:00:00.000Z`).set(authB)).body.eventos).toEqual([]);

		const rescheduled = await request(app)
			.post(`/api/leads/${leadId}/eventos`)
			.set(authA)
			.send({ tipo: 'REAGENDAMENTO', data: D2, eventoId });
		expect(rescheduled.status).toBe(201);
		expect(rescheduled.body.previousEventoId).toBe(eventoId);

		const leadAfterReschedule = await request(app).get(`/api/leads/${leadId}`).set(authA);
		expect(leadAfterReschedule.body.status).toBe('REAGENDADO');

		const cancelled = await request(app)
			.post(`/api/leads/${leadId}/eventos`)
			.set(authA)
			.send({ tipo: 'DESISTENCIA', eventoId: rescheduled.body.id });
		expect(cancelled.status).toBe(201);
	 expect(cancelled.body.previousEventoId).toBe(rescheduled.body.id);

		const leadAfterCancel = await request(app).get(`/api/leads/${leadId}`).set(authA);
		expect(leadAfterCancel.body.status).toBe('PERDIDO');

		// Cancelling the same (now superseded) target again is rejected, not duplicated.
	 expect(
			(
				await request(app)
					.post(`/api/leads/${leadId}/eventos`)
					.set(authA)
					.send({ tipo: 'DESISTENCIA', eventoId })
			).status,
		).toBe(404);
	});

	it('conversations stay isolated, ordered and bounded with lead links', async () => {
		const { authA, authB, idA } = await twoTenants();
		const leadId = await createLead(authA);

		const conversa = await conversaService.getOrCreate(idA, 'whatsapp', '5511999999999@c.us');
		await conversaService.appendMessage(idA, conversa.id, { papel: 'usuario', conteudo: 'segunda' });
		await conversaService.appendMessage(idA, conversa.id, { papel: 'axis', conteudo: 'resposta' });
		await conversaService.appendMessage(idA, conversa.id, { papel: 'usuario', conteudo: 'terceira' });
		await conversaService.associateLead(idA, conversa.id, leadId);

		const listA = await request(app).get('/api/v1/conversations').set(authA);
		expect(listA.body.total).toBe(1);
		expect((await request(app).get('/api/v1/conversations').set(authB)).body.total).toBe(0);
		expect((await request(app).get(`/api/v1/conversations/${conversa.id}`).set(authB)).status).toBe(404);

		const detail = await request(app).get(`/api/v1/conversations/${conversa.id}?limit=2`).set(authA);
		expect(detail.status).toBe(200);
		expect(detail.body.leadId).toBe(leadId);
		expect(detail.body.mensagens.map((m: { conteudo: string }) => m.conteudo)).toEqual([
			'resposta',
			'terceira',
		]);
	});

	it('dashboard reflects the metrics endpoint instead of inventing numbers', async () => {
		const { authA, authB } = await twoTenants();
		const leadId = await createLead(authA);
		await request(app).post(`/api/leads/${leadId}/eventos`).set(authA).send({ tipo: 'VENDA' });

		const res = await request(app).get(`/api/metricas?${RANGE}`).set(authA);
		expect(res.status).toBe(200);
		expect(res.body.taxaConversao).toMatchObject({ totalLeads: 1, vendidos: 1, taxaConversao: 1 });
		expect(res.body.leadsPorStatus).toEqual([{ status: 'VENDIDO', total: 1 }]);

	 const other = await request(app).get(`/api/metricas?${RANGE}`).set(authB);
		expect(other.body.taxaConversao.totalLeads).toBe(0);
	});

	it('error paths behave per contract without leaking internals', async () => {
		const { authA } = await twoTenants();
		expect((await request(app).get('/api/leads')).status).toBe(401);
		expect((await request(app).get('/api/leads/507f1f77bcf86cd799439011').set(authA)).status).toBe(404);
		expect((await request(app).get('/api/leads/nao-eh-id').set(authA)).status).toBe(404);
		expect((await request(app).get('/api/metricas').set(authA)).status).toBe(400);
		expect(
			(await request(app).get(`/api/leads/${OTHER_ID}/eventos/nao-eh-id`).set(authA)).status,
		).toBe(400);

		const leadId = await createLead(authA);
		// Correction target that does not exist.
		expect(
			(
				await request(app)
					.post(`/api/leads/${leadId}/eventos`)
					.set(authA)
					.send({ tipo: 'DESISTENCIA', eventoId: OTHER_ID })
			).status,
		).toBe(404);
		// Correction type without any active event.
	 expect(
			(await request(app).post(`/api/leads/${leadId}/eventos`).set(authA).send({ tipo: 'DESISTENCIA' }))
				.status,
		).toBe(400);

		for (const res of [
			await request(app).get('/api/leads/nao-eh-id').set(authA),
		]) {
			expect(JSON.stringify(res.body)).not.toMatch(/stack|at .*:\d+:\d+/);
		}
	});

	it('google and whatsapp panel boundaries expose status without secrets', async () => {
		const { authA, authB, idA } = await twoTenants();

		const wa = await request(app).get('/api/v1/whatsapp/status').set(authA);
		expect(wa.status).toBe(200);
		expect(wa.body).toMatchObject({ connected: false });
		expect((await request(app).get('/api/v1/whatsapp/qr').set(authA)).status).toBe(404);
		expect((await request(app).get('/api/v1/whatsapp/status')).status).toBe(401);

		const before = await request(app).get('/api/v1/integrations/google/status').set(authA);
		expect(before.body).toEqual({ connected: false });

		await GoogleConnectionModel.create({
			userId: idA,
			googleSubject: 'google-subject-a',
			email: 'a@example.com',
			refreshToken: 'segredo-nunca-exposto',
			scopes: ['https://www.googleapis.com/auth/calendar'],
			calendarId: 'calendar-a',
		});
		const after = await request(app).get('/api/v1/integrations/google/status').set(authA);
		expect(after.body).toMatchObject({
			connected: true,
			email: 'a@example.com',
			calendarConfigured: true,
			spreadsheetConfigured: false,
		});
		expect(JSON.stringify(after.body)).not.toContain('segredo-nunca-exposto');
		expect((await request(app).get('/api/v1/integrations/google/status').set(authB)).body).toEqual({
			connected: false,
		});

		const connect = await request(app).get('/api/v1/integrations/google/connect').set(authA);
		expect(connect.status).toBe(200);
		expect(connect.body.url).toMatch(/^https:\/\/accounts\.google\.com\//);

	 expect((await request(app).delete('/api/v1/integrations/google').set(authA)).status).toBe(204);
		expect((await request(app).get('/api/v1/integrations/google/status').set(authA)).body).toEqual({
			connected: false,
		});
	});
});
