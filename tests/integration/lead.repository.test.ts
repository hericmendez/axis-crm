import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import * as leadRepository from '../../src/repositories/lead.repository.js';

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
	telefone: '11912345678',
	contatoOrigem: 'instagram',
};

describe('leadRepository', () => {
	it('cria e encontra por id', async () => {
		const created = await leadRepository.create(baseLead);
		expect(created.id).toBeDefined();
		expect(created.createdAt).toBeInstanceOf(Date);

		const found = await leadRepository.findById(created.id);
		expect(found?.nome).toBe('João');
	});

	it('retorna null para id inexistente ou malformado', async () => {
		expect(await leadRepository.findById('507f1f77bcf86cd799439011')).toBeNull();
		expect(await leadRepository.findById('id-invalido')).toBeNull();
	});

	it('encontra por telefone', async () => {
		await leadRepository.create(baseLead);
		const found = await leadRepository.findByTelefone('11912345678');
		expect(found?.nome).toBe('João');
	});

	it('lista com filtro de status e paginação', async () => {
		for (let i = 0; i < 5; i++) {
			await leadRepository.create({ ...baseLead, telefone: `1191234567${i}` });
		}
		const page1 = await leadRepository.find({}, { page: 1, limit: 3 });
		expect(page1.total).toBe(5);
		expect(page1.items).toHaveLength(3);
		expect(page1.page).toBe(1);

		const page2 = await leadRepository.find({}, { page: 2, limit: 3 });
		expect(page2.items).toHaveLength(2);
	});

	it('atualiza e retorna documento atualizado', async () => {
		const created = await leadRepository.create(baseLead);
		const updated = await leadRepository.updateById(created.id, { nome: 'Maria' });
		expect(updated?.nome).toBe('Maria');
		expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
			updated?.createdAt.getTime() ?? Infinity,
		);
	});

	it('remove e retorna true; segunda remoção retorna false', async () => {
		const created = await leadRepository.create(baseLead);
		expect(await leadRepository.deleteById(created.id)).toBe(true);
		expect(await leadRepository.deleteById(created.id)).toBe(false);
	});
});
