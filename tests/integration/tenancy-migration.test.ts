import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import { LeadModel } from '../../src/models/lead.model.js';
import { EventoModel } from '../../src/models/evento.model.js';
import { ConversaModel } from '../../src/models/conversa.model.js';
import { UserModel } from '../../src/models/user.model.js';
import {
	backfillTenancy,
	countMissingTenancy,
	dropLegacyIndexes,
} from '../../src/migrations/backfill-tenancy.js';

const OPERATOR = new Types.ObjectId().toString();
const OTHER = new Types.ObjectId().toString();

async function seedLegacy() {
	// Bypass Mongoose validation to simulate pre-migration documents without userId.
	await LeadModel.collection.insertOne({ nome: 'L', telefone: '11999990001', contatoOrigem: 'w' });
	const leadId = new Types.ObjectId();
	await EventoModel.collection.insertOne({ leadId, tipo: 'AGENDAMENTO', data: new Date() });
	await ConversaModel.collection.insertOne({ canal: 'whatsapp', chatIdExterno: 'chat@c.us', mensagens: [] });
}

describe('tenancy migration', () => {
	beforeAll(async () => {
		const uri = await startTestMongo();
		await mongoose.connect(uri);
		await UserModel.create({ _id: new Types.ObjectId(OPERATOR), name: 'Operator' });
	});

	beforeEach(async () => {
		await clearCollections();
		await UserModel.create({ _id: new Types.ObjectId(OPERATOR), name: 'Operator' });
	});

	afterAll(async () => {
		await stopTestMongo();
	});

	it('atribui documentos sem userId ao operador', async () => {
		await seedLegacy();
		const result = await backfillTenancy(OPERATOR);
		expect(result).toEqual({ leads: 1, eventos: 1, conversas: 1 });

		const lead = await LeadModel.findOne({ telefone: '11999990001' }).lean();
		expect(String(lead?.userId)).toBe(OPERATOR);
		expect(await countMissingTenancy()).toEqual({ leads: 0, eventos: 0, conversas: 0 });
	});

	it('não altera documentos que já possuem userId', async () => {
		await seedLegacy();
		await LeadModel.collection.insertOne({
			nome: 'Owned',
			telefone: '11999990002',
			contatoOrigem: 'w',
			userId: new Types.ObjectId(OTHER),
		});
		await backfillTenancy(OPERATOR);
		const owned = await LeadModel.findOne({ telefone: '11999990002' }).lean();
		expect(String(owned?.userId)).toBe(OTHER);
	});

	it('é idempotente: segunda execução não altera nada', async () => {
		await seedLegacy();
		await backfillTenancy(OPERATOR);
		const second = await backfillTenancy(OPERATOR);
		expect(second).toEqual({ leads: 0, eventos: 0, conversas: 0 });
	});

	it('falha claramente sem operador ou com operador inexistente', async () => {
		await expect(backfillTenancy('')).rejects.toMatchObject({ statusCode: 400 });
		await expect(backfillTenancy('nao-objectid')).rejects.toMatchObject({ statusCode: 400 });
		await expect(backfillTenancy(new Types.ObjectId().toString())).rejects.toMatchObject({
			statusCode: 400,
		});
	});

	it('dropLegacyIndexes é idempotente e garante os novos índices', async () => {
		const first = await dropLegacyIndexes();
		expect(Array.isArray(first)).toBe(true);
		const second = await dropLegacyIndexes();
		expect(second).toEqual([]);
		const indexes = await LeadModel.collection.indexes();
		const names = indexes.map((i) => i.name);
		expect(names).toContain('userId_1_telefone_1');
	});
});
