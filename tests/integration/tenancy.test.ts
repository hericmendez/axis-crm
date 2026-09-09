import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import * as leadService from '../../src/services/lead.service.js';
import * as eventoService from '../../src/services/evento.service.js';
import * as conversaService from '../../src/services/conversa.service.js';
import * as agendaService from '../../src/services/agenda.service.js';
import { routeIntent } from '../../src/ai/intent-router.js';
import type { InternalTool } from '../../src/ai/tools/internal-tool.js';
import * as leadRepository from '../../src/repositories/lead.repository.js';

const USER_A = '507f1f77bcf86cd799439011';
const USER_B = '507f1f77bcf86cd799439022';

function okTool(message = 'ok'): InternalTool {
	return { execute: vi.fn().mockResolvedValue({ type: 'SUCCESS', message }) };
}

describe('tenancy matrix (serviços + resolução)', () => {
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

	it('Lead: A lê A; A lendo/atualizando/removendo B → 404', async () => {
		const leadB = await leadService.create(USER_B, {
			nome: 'Lead B',
			telefone: '11999990001',
			contatoOrigem: 'whatsapp',
		});
		await expect(leadService.getById(USER_A, leadB.id)).rejects.toMatchObject({ statusCode: 404 });
		await expect(leadService.update(USER_A, leadB.id, { nome: 'X' })).rejects.toMatchObject({
			statusCode: 404,
		});
		await expect(leadService.remove(USER_A, leadB.id)).rejects.toMatchObject({ statusCode: 404 });
		expect((await leadService.getById(USER_B, leadB.id)).nome).toBe('Lead B');
	});

	it('Lead: list retorna somente o próprio tenant', async () => {
		await leadService.create(USER_A, { nome: 'A', telefone: '11999990001', contatoOrigem: 'w' });
		await leadService.create(USER_B, { nome: 'B', telefone: '11999990002', contatoOrigem: 'w' });
		const listA = await leadService.list(USER_A, {}, { page: 1, limit: 10 });
		expect(listA.total).toBe(1);
		expect(listA.items[0]?.nome).toBe('A');
	});

	it('Evento: listByLead e resolveTarget não atravessam tenant', async () => {
		const leadA = await leadService.create(USER_A, { nome: 'A', telefone: '11999990001', contatoOrigem: 'w' });
		const leadB = await leadService.create(USER_B, { nome: 'B', telefone: '11999990002', contatoOrigem: 'w' });
		const eventoB = await eventoService.create({
			userId: USER_B,
			leadId: leadB.id,
			tipo: 'AGENDAMENTO',
			data: new Date('2026-09-10T10:00:00-03:00'),
		});

		await expect(eventoService.listByLead(USER_A, leadB.id)).rejects.toMatchObject({ statusCode: 404 });
		expect(await eventoService.listByLead(USER_B, leadB.id)).toHaveLength(1);
		expect(await eventoService.resolveTarget(USER_A, leadB.id, { eventoId: eventoB.id })).toEqual({
			status: 'NOT_FOUND',
		});
		expect(await eventoService.listByLead(USER_A, leadA.id)).toHaveLength(0);
	});

	it('Conversa: associateLead com lead de outro tenant → 404', async () => {
		const conversa = await conversaService.getOrCreate(USER_A, 'whatsapp', 'chat-a@c.us');
		const leadB = await leadService.create(USER_B, { nome: 'B', telefone: '11999990002', contatoOrigem: 'w' });
		await expect(conversaService.associateLead(USER_A, conversa.id, leadB.id)).rejects.toMatchObject({
			statusCode: 404,
		});
	});

	it('AgendaService.consultarAgenda retorna somente eventos do tenant', async () => {
		const leadA = await leadService.create(USER_A, { nome: 'A', telefone: '11999990001', contatoOrigem: 'w' });
		const leadB = await leadService.create(USER_B, { nome: 'B', telefone: '11999990002', contatoOrigem: 'w' });
		await eventoService.create({
			userId: USER_A,
			leadId: leadA.id,
			tipo: 'AGENDAMENTO',
			data: new Date('2026-09-10T10:00:00-03:00'),
		});
		await eventoService.create({
			userId: USER_B,
			leadId: leadB.id,
			tipo: 'AGENDAMENTO',
			data: new Date('2026-09-10T11:00:00-03:00'),
		});

		const de = new Date('2026-09-10T00:00:00-03:00');
		const ate = new Date('2026-09-11T00:00:00-03:00');
		const viewA = await agendaService.consultarAgenda(USER_A, de, ate);
		expect(viewA.eventos).toHaveLength(1);
		expect(viewA.eventos[0]?.leadId).toBe(leadA.id);
		const viewB = await agendaService.consultarAgenda(USER_B, de, ate);
		expect(viewB.eventos).toHaveLength(1);
		expect(viewB.eventos[0]?.leadId).toBe(leadB.id);
	});

	it('Intent Router: "Carlos" de B é invisível para A (NOT_FOUND), AMBIGUOUS só no próprio tenant', async () => {
		await leadService.create(USER_B, { nome: 'Carlos', telefone: '11999990001', contatoOrigem: 'w' });
		await leadService.create(USER_A, { nome: 'João', telefone: '11999990002', contatoOrigem: 'w' });
		await leadService.create(USER_A, { nome: 'João', telefone: '11999990003', contatoOrigem: 'w' });

		const deps = {
			leadService: {
				create: vi.fn(),
				update: vi.fn(),
				getById: vi.fn(),
			},
			eventoService: { create: vi.fn(), resolveTarget: vi.fn() },
			metricasService: { agenda: vi.fn() },
			leadRepository,
			tools: {
				createLead: okTool(),
				updateLead: okTool('Lead atualizado.'),
				registerEvent: okTool(),
				consultAgenda: okTool(),
			},
		};

		const crossTenant = await routeIntent(
			{
				mode: 'ACTION',
				intent: 'ATUALIZAR_LEAD',
				confidence: 0.9,
				parameters: { leadRef: 'Carlos', status: 'VENDIDO' },
			},
			deps,
			undefined,
			USER_A,
		);
		expect(crossTenant.type).toBe('ENTITY_NOT_FOUND');

		const ambiguous = await routeIntent(
			{
				mode: 'ACTION',
				intent: 'ATUALIZAR_LEAD',
				confidence: 0.9,
				parameters: { leadRef: 'João', status: 'VENDIDO' },
			},
			deps,
			undefined,
			USER_A,
		);
		expect(ambiguous.type).toBe('AMBIGUOUS_ENTITY');
		if (ambiguous.type === 'AMBIGUOUS_ENTITY') {
			expect(ambiguous.candidates).toHaveLength(2);
		}
	});

	it('serviços sem identidade falham com 401', async () => {
		await expect(leadService.list('', {}, { page: 1, limit: 10 })).rejects.toMatchObject({
			statusCode: 401,
		});
		await expect(eventoService.listByLead(undefined as never, 'x')).rejects.toMatchObject({
			statusCode: 401,
		});
		await expect(agendaService.consultarAgenda(undefined, new Date(), new Date())).rejects.toMatchObject({
			statusCode: 401,
		});
	});
});
