import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import * as leadService from '../../src/services/lead.service.js';
import { AppError } from '../../src/utils/errors.js';

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

describe('leadService', () => {
	it('normaliza telefone antes de criar', async () => {
		const lead = await leadService.create(baseLead);
		expect(lead.telefone).toBe('11912345678');
	});

	it('rejeita telefone inválido com AppError 400', async () => {
		await expect(
			leadService.create({ ...baseLead, telefone: '999' }),
		).rejects.toMatchObject({ statusCode: 400 });
	});

	it('não permite dois leads com o mesmo telefone normalizado', async () => {
		await leadService.create(baseLead);
		await expect(
			leadService.create({ ...baseLead, nome: 'Duplicado', telefone: '11.91234.5678' }),
		).rejects.toBeInstanceOf(AppError);
	});

	it('getById lança 404 para id inexistente', async () => {
		await expect(leadService.getById('507f1f77bcf86cd799439011')).rejects.toMatchObject({
			statusCode: 404,
		});
	});

	it('update atualiza ultimaInteracao e aceita qualquer transição de status', async () => {
		const lead = await leadService.create(baseLead);
		const updated = await leadService.update(lead.id, { status: 'PERDIDO' });
		expect(updated.status).toBe('PERDIDO');
		expect(updated.ultimaInteracao).toBeInstanceOf(Date);
	});

	it('update rejeita dataConversao sem status VENDIDO', async () => {
		const lead = await leadService.create(baseLead);
		await expect(
			leadService.update(lead.id, { dataConversao: new Date() }),
		).rejects.toMatchObject({ statusCode: 422 });
	});

	it('remove lead existente e lança 404 na segunda remoção', async () => {
		const lead = await leadService.create(baseLead);
		await leadService.remove(lead.id);
		await expect(leadService.remove(lead.id)).rejects.toMatchObject({ statusCode: 404 });
	});
});
