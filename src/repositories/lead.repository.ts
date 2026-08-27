import {
	type CreateLeadInput,
	type Lead,
	type PaginatedResult,
	type PaginationParams,
	type UpdateLeadInput,
} from '../types/lead.js';
import type { LeadsPorStatus } from '../types/evento.js';
import { LeadModel, toLeadDTO } from '../models/lead.model.js';

export async function create(data: CreateLeadInput): Promise<Lead> {
	const doc = await LeadModel.create(data);
	return toLeadDTO(doc.toObject());
}

export async function findById(id: string): Promise<Lead | null> {
	if (!id.match(/^[0-9a-fA-F]{24}$/)) return null;
	const doc = await LeadModel.findById(id).lean();
	return doc ? toLeadDTO(doc) : null;
}

export async function findByTelefone(telefone: string): Promise<Lead | null> {
	const doc = await LeadModel.findOne({ telefone }).lean();
	return doc ? toLeadDTO(doc) : null;
}

export async function find(
	filter: Partial<Pick<Lead, 'status'>>,
	pagination: PaginationParams,
): Promise<PaginatedResult<Lead>> {
	const { page, limit } = pagination;
	const [docs, total] = await Promise.all([
		LeadModel.find(filter)
			.sort({ createdAt: -1 })
			.skip((page - 1) * limit)
			.limit(limit)
			.lean(),
		LeadModel.countDocuments(filter),
	]);
	return { items: docs.map(toLeadDTO), total, page, limit };
}

export async function updateById(id: string, patch: UpdateLeadInput): Promise<Lead | null> {
	if (!id.match(/^[0-9a-fA-F]{24}$/)) return null;
	const doc = await LeadModel.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true }).lean();
	return doc ? toLeadDTO(doc) : null;
}

export async function findByAgendamentoPeriodo(
	de: Date,
	ate: Date,
): Promise<Lead[]> {
	const docs = await LeadModel.find({ dataAgendamento: { $gte: de, $lt: ate } })
		.sort({ dataAgendamento: 1 })
		.lean();
	return docs.map(toLeadDTO);
}

export async function countByStatus(): Promise<LeadsPorStatus[]> {
	const results = await LeadModel.aggregate<{ _id: string | null; total: number }>([
		{ $group: { _id: '$status', total: { $sum: 1 } } },
	]);
	return results.map((r) => ({
		status: (r._id ?? 'SEM_STATUS') as LeadsPorStatus['status'],
		total: r.total,
	}));
}

export async function findByName(nome: string): Promise<Lead[]> {
	const escaped = nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const docs = await LeadModel.find({
		nome: { $regex: new RegExp(`^${escaped}$`, 'i') },
	}).lean();
	return docs.map(toLeadDTO);
}

export async function deleteById(id: string): Promise<boolean> {
	if (!id.match(/^[0-9a-fA-F]{24}$/)) return false;
	const result = await LeadModel.findByIdAndDelete(id);
	return result !== null;
}
