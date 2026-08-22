import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import * as leadService from '../../src/services/lead.service.js';
import * as eventoService from '../../src/services/evento.service.js';
import * as metricasService from '../../src/services/metricas.service.js';
import { AppError } from '../../src/utils/errors.js';

vi.mock('../../src/repositories/lead.repository.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/repositories/lead.repository.js')>();
	return { ...actual };
});

const baseLead = {
	nome: 'Maria',
	telefone: '11987654321',
	contatoOrigem: 'indicacao',
};

describe('eventos: efeitos no lead e imutabilidade', () => {
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

	it('AGENDAMENTO atualiza dataAgendamento do lead', async () => {
		const lead = await leadService.create(baseLead);
		const data = new Date('2026-09-01T10:00:00Z');
		await eventoService.create({ leadId: lead.id, tipo: 'AGENDAMENTO', data });

		const updated = await leadService.getById(lead.id);
		expect(updated.dataAgendamento?.toISOString()).toBe(data.toISOString());
	});

	it('REAGENDAMENTO atualiza dataAgendamento e status REAGENDADO', async () => {
		const lead = await leadService.create(baseLead);
		const novaData = new Date('2026-09-05T14:00:00Z');
		await eventoService.create({ leadId: lead.id, tipo: 'AGENDAMENTO' });
		await eventoService.create({ leadId: lead.id, tipo: 'REAGENDAMENTO', data: novaData });

		const updated = await leadService.getById(lead.id);
		expect(updated.status).toBe('REAGENDADO');
		expect(updated.dataAgendamento?.toISOString()).toBe(novaData.toISOString());
	});

	it('VENDA define status VENDIDO e dataConversao', async () => {
		const lead = await leadService.create(baseLead);
		const data = new Date('2026-09-02T18:30:00Z');
		await eventoService.create({ leadId: lead.id, tipo: 'VENDA', data });

		const updated = await leadService.getById(lead.id);
		expect(updated.status).toBe('VENDIDO');
		expect(updated.dataConversao?.toISOString()).toBe(data.toISOString());
	});

	it('DESISTENCIA define status PERDIDO', async () => {
		const lead = await leadService.create(baseLead);
		await eventoService.create({ leadId: lead.id, tipo: 'DESISTENCIA' });

		const updated = await leadService.getById(lead.id);
		expect(updated.status).toBe('PERDIDO');
	});

	it('NO_SHOW define status NO_SHOW', async () => {
		const lead = await leadService.create(baseLead);
		await eventoService.create({ leadId: lead.id, tipo: 'NO_SHOW' });

		const updated = await leadService.getById(lead.id);
		expect(updated.status).toBe('NO_SHOW');
	});

	it('rejeita evento para lead inexistente com 404', async () => {
		await expect(
			eventoService.create({ leadId: '507f1f77bcf86cd799439011', tipo: 'VENDA' }),
		).rejects.toMatchObject({ statusCode: 404 } satisfies Partial<AppError>);
	});

	it('eventos são imutáveis: sem método de alteração exposto', async () => {
		expect(eventoService.update).toBeUndefined();
		expect(eventoService.remove).toBeUndefined();
	});
});

describe('métricas e agenda', () => {
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

	it('leadsPorStatus agrupa corretamente', async () => {
		await leadService.create(baseLead);
		await leadService.create({ ...baseLead, telefone: '11999999999', status: 'VENDIDO' });

		const porStatus = await metricasService.leadsPorStatus();
		const vendidos = porStatus.find((s) => s.status === 'VENDIDO');
		const semStatus = porStatus.find((s) => s.status === 'SEM_STATUS');
		expect(vendidos?.total).toBe(1);
		expect(semStatus?.total).toBe(1);
	});

	it('taxaConversao calcula proporção de vendidos', async () => {
		const l1 = await leadService.create(baseLead);
		await leadService.create({ ...baseLead, telefone: '11999999999' });
		await eventoService.create({ leadId: l1.id, tipo: 'VENDA' });

		const taxa = await metricasService.taxaConversao();
		expect(taxa.totalLeads).toBe(2);
		expect(taxa.vendidos).toBe(1);
		expect(taxa.taxaConversao).toBeCloseTo(0.5);
	});

	it('eventosPorTipo respeita intervalo >= de e < ate', async () => {
		const lead = await leadService.create(baseLead);
		await eventoService.create({
			leadId: lead.id,
			tipo: 'VENDA',
			data: new Date('2026-09-01T10:00:00Z'),
		});
		await eventoService.create({
			leadId: lead.id,
			tipo: 'NO_SHOW',
			data: new Date('2026-09-02T10:00:00Z'),
		});

		const dentro = await metricasService.eventosPorTipo({
			de: new Date('2026-09-01T10:00:00Z'),
			ate: new Date('2026-09-02T10:00:00Z'),
		});
		expect(dentro).toEqual([{ tipo: 'VENDA', total: 1 }]);

		const fora = await metricasService.eventosPorTipo({
			de: new Date('2026-09-02T10:00:00Z'),
			ate: new Date('2026-09-03T10:00:00Z'),
		});
		expect(fora).toEqual([{ tipo: 'NO_SHOW', total: 1 }]);
	});

	it('agenda consulta apenas lead.dataAgendamento com intervalo meio-aberto', async () => {
		const l1 = await leadService.create(baseLead);
		await eventoService.create({
			leadId: l1.id,
			tipo: 'AGENDAMENTO',
			data: new Date('2026-09-01T10:00:00Z'),
		});
		const l2 = await leadService.create({ ...baseLead, telefone: '11999999999' });
		await eventoService.create({
			leadId: l2.id,
			tipo: 'AGENDAMENTO',
			data: new Date('2026-09-02T10:00:00Z'),
		});

		const agendaDia1 = await metricasService.agenda(
			new Date('2026-09-01T00:00:00Z'),
			new Date('2026-09-02T00:00:00Z'),
		);
		expect(agendaDia1).toHaveLength(1);
		expect(agendaDia1[0].leadId).toBe(l1.id);

		const agendaDoisDias = await metricasService.agenda(
			new Date('2026-09-01T00:00:00Z'),
			new Date('2026-09-03T00:00:00Z'),
		);
		expect(agendaDoisDias).toHaveLength(2);
	});
});
