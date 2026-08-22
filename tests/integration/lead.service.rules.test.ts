import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import * as leadRepository from '../../src/repositories/lead.repository.js';
import * as leadService from '../../src/services/lead.service.js';
import { createLeadSchema, updateLeadSchema } from '../../src/validators/lead.validator.js';
import { AppError } from '../../src/utils/errors.js';

vi.mock('../../src/repositories/lead.repository.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/repositories/lead.repository.js')>();
	return { ...actual };
});

const baseLead = {
	nome: 'João',
	telefone: '11912345678',
	contatoOrigem: 'instagram',
};

describe('regras de venda no service', () => {
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

	it('create rejeita dataConversao sem status VENDIDO', async () => {
		await expect(
			leadService.create({ ...baseLead, dataConversao: new Date() }),
		).rejects.toMatchObject({ statusCode: 422 });
	});

	it('create com VENDIDO preenche dataConversao automaticamente', async () => {
		const lead = await leadService.create({ ...baseLead, status: 'VENDIDO' });
		expect(lead.dataConversao).toBeInstanceOf(Date);
	});

	it('race condition: E11000 do índice unique vira 409', async () => {
		vi.spyOn(leadRepository, 'create').mockRejectedValueOnce({ code: 11000 });
		await expect(leadService.create(baseLead)).rejects.toMatchObject({
			statusCode: 409,
		});
	});

	it('outros erros de banco não são mascarados como 409', async () => {
		vi.spyOn(leadRepository, 'create').mockRejectedValueOnce(new Error('boom'));
		await expect(leadService.create(baseLead)).rejects.not.toBeInstanceOf(AppError);
	});
});

describe('PATCH não altera telefone', () => {
	it('updateLeadSchema descarta telefone', () => {
		const result = updateLeadSchema.parse({ nome: 'Maria', telefone: '11999999999' });
		expect(result).not.toHaveProperty('telefone');
		expect(result.nome).toBe('Maria');
	});

	it('createLeadSchema mantém telefone obrigatório', () => {
		expect(createLeadSchema.safeParse({ nome: 'x', contatoOrigem: 'y' }).success).toBe(false);
	});
});
