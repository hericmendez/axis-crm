import type {
	CreateEventoInput,
	Evento,
	EventoTipo,
	Periodo,
} from '../types/evento.js';
import { Types } from 'mongoose';
import { EventoModel, toEventoDTO } from '../models/evento.model.js';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

function assertTenant(userId: string | undefined): boolean {
	return typeof userId === 'string' && OBJECT_ID_RE.test(userId);
}

export async function create(data: CreateEventoInput): Promise<Evento> {
	const doc = await EventoModel.create(data);
	return toEventoDTO(doc.toObject());
}

export async function findById(userId: string | undefined, id: string): Promise<Evento | null> {
	if (!assertTenant(userId) || !OBJECT_ID_RE.test(id)) return null;
	const doc = await EventoModel.findOne({ _id: id, userId }).lean();
	return doc ? toEventoDTO(doc as Record<string, unknown>) : null;
}

export async function deleteById(userId: string | undefined, id: string): Promise<boolean> {
	if (!assertTenant(userId) || !OBJECT_ID_RE.test(id)) return false;
	const result = await EventoModel.findOneAndDelete({ _id: id, userId });
	return result !== null;
}

export async function findByLeadId(userId: string | undefined, leadId: string): Promise<Evento[]> {
	if (!assertTenant(userId) || !OBJECT_ID_RE.test(leadId)) return [];
	const docs = await EventoModel.find({ userId, leadId }).sort({ data: 1 }).lean();
	return docs.map(toEventoDTO);
}

export async function findByDataPeriodo(userId: string | undefined, de: Date, ate: Date): Promise<Evento[]> {
	if (!assertTenant(userId)) return [];
	const docs = await EventoModel.find({ userId, data: { $gte: de, $lt: ate } })
		.sort({ data: 1 })
		.lean();
	return docs.map(toEventoDTO);
}

export async function countByTipoInPeriod(
	userId: string | undefined,
	periodo: Periodo,
): Promise<{ tipo: EventoTipo; total: number }[]> {
	if (!assertTenant(userId)) return [];
	const results = await EventoModel.aggregate<{ _id: EventoTipo; total: number }>([
		{ $match: { userId: new Types.ObjectId(userId), data: { $gte: periodo.de, $lt: periodo.ate } } },
		{ $group: { _id: '$tipo', total: { $sum: 1 } } },
		{ $sort: { total: -1 } },
	]);
	return results.map((r) => ({ tipo: r._id, total: r.total }));
}

export async function findLastActiveForLead(userId: string | undefined, leadId: string): Promise<Evento | null> {
	const ativos = await findActiveForLead(userId, leadId);
	return ativos[0] ?? null;
}

export async function findActiveForLead(userId: string | undefined, leadId: string): Promise<Evento[]> {
	if (!assertTenant(userId) || !OBJECT_ID_RE.test(leadId)) return [];

	const eventos = await EventoModel.find({ userId, leadId })
		.sort({ createdAt: -1 })
		.lean();

	const replacedIds = new Set<string>();
	for (const doc of eventos) {
		const prev = doc.previousEventoId;
		if (prev) {
			replacedIds.add(String(prev));
		}
	}

	const ativos: Evento[] = [];
	for (const doc of eventos) {
		const tipo = doc.tipo as EventoTipo;
		if (tipo !== 'AGENDAMENTO' && tipo !== 'REAGENDAMENTO') continue;

		const eventoId = String(doc._id);
		if (replacedIds.has(eventoId)) continue;

		ativos.push(toEventoDTO(doc as Record<string, unknown>));
	}

	return ativos;
}

export async function updateGoogleEventId(
	userId: string | undefined,
	eventoId: string,
	googleEventId: string,
): Promise<boolean> {
	if (!assertTenant(userId) || !OBJECT_ID_RE.test(eventoId)) return false;
	const result = await EventoModel.findOneAndUpdate(
		{ _id: eventoId, userId },
		{ $set: { googleEventId } },
		{ new: true },
	);
	return result !== null;
}
