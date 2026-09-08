import type {
	CreateEventoInput,
	Evento,
	EventoTipo,
	Periodo,
} from '../types/evento.js';
import { EventoModel, toEventoDTO } from '../models/evento.model.js';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export async function create(data: CreateEventoInput): Promise<Evento> {
	const doc = await EventoModel.create(data);
	return toEventoDTO(doc.toObject());
}

export async function findById(id: string): Promise<Evento | null> {
	if (!OBJECT_ID_RE.test(id)) return null;
	const doc = await EventoModel.findById(id).lean();
	return doc ? toEventoDTO(doc as Record<string, unknown>) : null;
}

export async function deleteById(id: string): Promise<boolean> {
	if (!OBJECT_ID_RE.test(id)) return false;
	const result = await EventoModel.findByIdAndDelete(id);
	return result !== null;
}

export async function findByLeadId(leadId: string): Promise<Evento[]> {
	if (!OBJECT_ID_RE.test(leadId)) return [];
	const docs = await EventoModel.find({ leadId }).sort({ data: 1 }).lean();
	return docs.map(toEventoDTO);
}

export async function countByTipoInPeriod(
	periodo: Periodo,
): Promise<{ tipo: EventoTipo; total: number }[]> {
	const results = await EventoModel.aggregate<{ _id: EventoTipo; total: number }>([
		{ $match: { data: { $gte: periodo.de, $lt: periodo.ate } } },
		{ $group: { _id: '$tipo', total: { $sum: 1 } } },
		{ $sort: { total: -1 } },
	]);
	return results.map((r) => ({ tipo: r._id, total: r.total }));
}

export async function findLastActiveForLead(leadId: string): Promise<Evento | null> {
	if (!OBJECT_ID_RE.test(leadId)) return null;

	const eventos = await EventoModel.find({ leadId })
		.sort({ createdAt: -1 })
		.lean();

	for (const doc of eventos) {
		const tipo = doc.tipo as EventoTipo;
		if (tipo !== 'AGENDAMENTO' && tipo !== 'REAGENDAMENTO') continue;

		const eventoId = String(doc._id);
		const isReplaced = eventos.some(
			(e) => String(e.previousEventoId) === eventoId,
		);

		if (!isReplaced) {
			return toEventoDTO(doc as Record<string, unknown>);
		}
	}

	return null;
}

export async function updateGoogleEventId(
	eventoId: string,
	googleEventId: string,
): Promise<boolean> {
	if (!OBJECT_ID_RE.test(eventoId)) return false;
	const result = await EventoModel.findByIdAndUpdate(
		eventoId,
		{ $set: { googleEventId } },
		{ new: true },
	);
	return result !== null;
}
