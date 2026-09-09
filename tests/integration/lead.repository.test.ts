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

const USER_A = '507f1f77bcf86cd799439011';
const USER_B = '507f1f77bcf86cd799439022';

const baseLead = {
	userId: USER_A,
	nome: 'João',
	telefone: '11912345678',
	contatoOrigem: 'instagram',
};

describe('leadRepository', () => {
	it('cria e encontra por id', async () => {
		const created = await leadRepository.create(baseLead);
		expect(created.id).toBeDefined();
		expect(created.createdAt).toBeInstanceOf(Date);

		const found = await leadRepository.findById(USER_A, created.id);
		expect(found?.nome).toBe('João');
	});

	it('retorna null para id inexistente ou malformado', async () => {
		expect(await leadRepository.findById(USER_A, '507f1f77bcf86cd799439099')).toBeNull();
		expect(await leadRepository.findById(USER_A, 'id-invalido')).toBeNull();
	});

	it('encontra por telefone', async () => {
		await leadRepository.create(baseLead);
		const found = await leadRepository.findByTelefone(USER_A, '11912345678');
		expect(found?.nome).toBe('João');
	});

	it('lista com filtro de status e paginação', async () => {
		for (let i = 0; i < 5; i++) {
			await leadRepository.create({ ...baseLead, telefone: `1191234567${i}` });
		}
		const page1 = await leadRepository.find(USER_A, {}, { page: 1, limit: 3 });
		expect(page1.total).toBe(5);
		expect(page1.items).toHaveLength(3);
		expect(page1.page).toBe(1);

		const page2 = await leadRepository.find(USER_A, {}, { page: 2, limit: 3 });
		expect(page2.items).toHaveLength(2);
	});

	it('atualiza e retorna documento atualizado', async () => {
		const created = await leadRepository.create(baseLead);
		const updated = await leadRepository.updateById(USER_A, created.id, { nome: 'Maria' });
		expect(updated?.nome).toBe('Maria');
		expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
			updated?.createdAt.getTime() ?? Infinity,
		);
	});

	it('remove e retorna true; segunda remoção retorna false', async () => {
		const created = await leadRepository.create(baseLead);
		expect(await leadRepository.deleteById(USER_A, created.id)).toBe(true);
		expect(await leadRepository.deleteById(USER_A, created.id)).toBe(false);
	});

	it('mesmo telefone pode existir para usuários diferentes', async () => {
		await leadRepository.create(baseLead);
		const outro = await leadRepository.create({ ...baseLead, userId: USER_B, nome: 'Outro' });
		expect(outro.userId).toBe(USER_B);
		expect(await leadRepository.findByTelefone(USER_B, '11912345678')).not.toBeNull();
	});

	it('tenant inválido não retorna nada (fail-closed)', async () => {
		await leadRepository.create(baseLead);
		expect(await leadRepository.findById('', baseLead.telefone)).toBeNull();
		expect(await leadRepository.findByTelefone('xxx', '11912345678')).toBeNull();
		expect(await leadRepository.findByName('', 'João')).toEqual([]);
		const page = await leadRepository.find('', {}, { page: 1, limit: 10 });
		expect(page.total).toBe(0);
	});
});
