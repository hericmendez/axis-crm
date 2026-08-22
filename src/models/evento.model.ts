import { Schema, model } from 'mongoose';
import { EVENTO_TIPOS, type Evento } from '../types/evento.js';

const eventoSchema = new Schema(
	{
		leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
		tipo: { type: String, enum: [...EVENTO_TIPOS], required: true },
		data: { type: Date, required: true },
		observacoes: { type: String, trim: true },
	},
	{ timestamps: { createdAt: true, updatedAt: false } },
);

export function toEventoDTO(doc: Record<string, unknown>): Evento {
	const raw = typeof doc.toObject === 'function' ? (doc.toObject() as Record<string, unknown>) : doc;
	const { _id, __v: _v, leadId, ...rest } = raw as {
		_id: unknown;
		__v?: unknown;
		leadId: unknown;
	};
	return {
		id: String(_id),
		leadId: String(leadId),
		...(rest as Omit<Evento, 'id' | 'leadId'>),
	};
}

export const EventoModel = model('Evento', eventoSchema);
