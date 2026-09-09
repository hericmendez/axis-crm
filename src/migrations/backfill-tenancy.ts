import { Types } from 'mongoose';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { LeadModel } from '../models/lead.model.js';
import { EventoModel } from '../models/evento.model.js';
import { ConversaModel } from '../models/conversa.model.js';
import { UserModel } from '../models/user.model.js';

export interface BackfillResult {
	leads: number;
	eventos: number;
	conversas: number;
}

const MISSING = { $or: [{ userId: { $exists: false } }, { userId: null }] };

// Assigns every domain document that has no owner to the explicit operator user.
// Idempotent: only documents WITHOUT userId are touched; re-running changes nothing.
export async function backfillTenancy(operatorUserId: string): Promise<BackfillResult> {
	if (!operatorUserId || !/^[0-9a-fA-F]{24}$/.test(operatorUserId)) {
		throw new AppError(400, 'Operador inválido: informe um User _id válido');
	}
	const operator = await UserModel.findById(operatorUserId).select('_id').lean();
	if (!operator) {
		throw new AppError(400, 'Operador não encontrado: nenhum User com esse _id');
	}

	const ownerId = new Types.ObjectId(operatorUserId);
	const [leads, eventos, conversas] = await Promise.all([
		LeadModel.updateMany(MISSING, { $set: { userId: ownerId } }),
		EventoModel.updateMany(MISSING, { $set: { userId: ownerId } }),
		ConversaModel.updateMany(MISSING, { $set: { userId: ownerId } }),
	]);

	const result = {
		leads: leads.modifiedCount,
		eventos: eventos.modifiedCount,
		conversas: conversas.modifiedCount,
	};
	logger.info({ ...result, operatorUserId }, 'Backfill de tenancy concluído');
	return result;
}

export async function countMissingTenancy(): Promise<BackfillResult> {
	const [leads, eventos, conversas] = await Promise.all([
		LeadModel.countDocuments(MISSING),
		EventoModel.countDocuments(MISSING),
		ConversaModel.countDocuments(MISSING),
	]);
	return { leads, eventos, conversas };
}

// Legacy single-tenant indexes that conflict with per-user uniqueness must go:
// - leads.telefone_1 (global unique → replaced by {userId, telefone} unique)
// - conversas.canal_1_chatIdExterno_1 (global unique → replaced by {userId, canal, chatIdExterno})
// Missing indexes are ignored so the step stays idempotent.
export async function dropLegacyIndexes(): Promise<string[]> {
	const dropped: string[] = [];
	const attempts: Array<{
		collection: { collectionName: string; dropIndex(name: string): Promise<unknown> };
	}> = [LeadModel, ConversaModel];
	const legacyNames = ['telefone_1', 'canal_1_chatIdExterno_1'];
	for (let i = 0; i < attempts.length; i++) {
		const model = attempts[i] as (typeof attempts)[number];
		const name = legacyNames[i] as string;
		try {
			await model.collection.dropIndex(name);
			dropped.push(`${model.collection.collectionName}.${name}`);
		} catch (err) {
			const code = typeof err === 'object' && err !== null && 'code' in err
				? (err as { code?: unknown }).code
				: undefined;
			if (code !== 27) throw err; // 27 = IndexNotFound: already gone, keep going
		}
	}
	await Promise.all([
		LeadModel.createIndexes(),
		EventoModel.createIndexes(),
		ConversaModel.createIndexes(),
	]);
	return dropped;
}
