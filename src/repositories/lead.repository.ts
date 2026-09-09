import {
	type CreateLeadInput,
	type Lead,
	type PaginatedResult,
	type PaginationParams,
	type UpdateLeadInput,
} from '../types/lead.js';
import type { LeadsPorStatus } from '../types/evento.js';
import { LeadModel, toLeadDTO } from '../models/lead.model.js';
import { Types } from 'mongoose';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

function assertTenant(userId: string | undefined): boolean {
	return typeof userId === 'string' && OBJECT_ID_RE.test(userId);
}

export async function create(data: CreateLeadInput): Promise<Lead> {
	const doc = await LeadModel.create(data);
	return toLeadDTO(doc.toObject());
}

export async function findById(userId: string | undefined, id: string): Promise<Lead | null> {
	if (!assertTenant(userId) || !OBJECT_ID_RE.test(id)) return null;
	const doc = await LeadModel.findOne({ _id: id, userId }).lean();
	return doc ? toLeadDTO(doc) : null;
}

export async function findByTelefone(userId: string | undefined, telefone: string): Promise<Lead | null> {
	if (!assertTenant(userId)) return null;
	const doc = await LeadModel.findOne({ userId, telefone }).lean();
	return doc ? toLeadDTO(doc) : null;
}

export type LeadListFilter = Partial<Pick<Lead, 'status' | 'telefone' | 'nome'>>;

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function find(
	userId: string | undefined,
	filter: LeadListFilter,
	pagination: PaginationParams,
): Promise<PaginatedResult<Lead>> {
	const { page, limit } = pagination;
	if (!assertTenant(userId)) return { items: [], total: 0, page, limit };
	const { nome, ...rest } = filter;
	const scoped = {
		...rest,
		...(nome ? { nome: { $regex: new RegExp(`^${escapeRegExp(nome)}$`, 'i') } } : {}),
		userId,
	};
	const [docs, total] = await Promise.all([
		LeadModel.find(scoped)
			.sort({ createdAt: -1 })
			.skip((page - 1) * limit)
			.limit(limit)
			.lean(),
		LeadModel.countDocuments(scoped),
	]);
	return { items: docs.map(toLeadDTO), total, page, limit };
}

export async function updateById(
	userId: string | undefined,
	id: string,
	patch: UpdateLeadInput,
): Promise<Lead | null> {
	if (!assertTenant(userId) || !OBJECT_ID_RE.test(id)) return null;
	const doc = await LeadModel.findOneAndUpdate(
		{ _id: id, userId },
		{ $set: patch },
		{ new: true, runValidators: true },
	).lean();
	return doc ? toLeadDTO(doc) : null;
}

export async function findByAgendamentoPeriodo(
	userId: string | undefined,
	de: Date,
	ate: Date,
): Promise<Lead[]> {
	if (!assertTenant(userId)) return [];
	const docs = await LeadModel.find({ userId, dataAgendamento: { $gte: de, $lt: ate } })
		.sort({ dataAgendamento: 1 })
		.lean();
	return docs.map(toLeadDTO);
}

export async function countByStatus(userId: string | undefined): Promise<LeadsPorStatus[]> {
	if (!assertTenant(userId)) return [];
	const results = await LeadModel.aggregate<{ _id: string | null; total: number }>([
		{ $match: { userId: new Types.ObjectId(userId) } },
		{ $group: { _id: '$status', total: { $sum: 1 } } },
	]);
	return results.map((r) => ({
		status: (r._id ?? 'SEM_STATUS') as LeadsPorStatus['status'],
		total: r.total,
	}));
}

export async function findByName(userId: string | undefined, nome: string): Promise<Lead[]> {
	if (!assertTenant(userId)) return [];
	const escaped = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const docs = await LeadModel.find({
		userId,
		nome: { $regex: new RegExp(`^${escaped}$`, 'i') },
	}).lean();
	return docs.map(toLeadDTO);
}

export async function deleteById(userId: string | undefined, id: string): Promise<boolean> {
	if (!assertTenant(userId) || !OBJECT_ID_RE.test(id)) return false;
	const result = await LeadModel.findOneAndDelete({ _id: id, userId });
	return result !== null;
}
