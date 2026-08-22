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
