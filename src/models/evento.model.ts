import { Schema, model } from 'mongoose';
import { EVENTO_TIPOS, type Evento } from '../types/evento.js';

const eventoSchema = new Schema(
	{
		userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
		tipo: { type: String, enum: [...EVENTO_TIPOS], required: true },
		data: { type: Date, required: true },
		observacoes: { type: String, trim: true },
		previousEventoId: { type: Schema.Types.ObjectId, ref: 'Evento', default: null },
		googleEventId: { type: String, default: null },
	},
	{ timestamps: { createdAt: true, updatedAt: false } },
);

eventoSchema.index({ userId: 1, leadId: 1 });
eventoSchema.index({ userId: 1, data: 1 });

export function toEventoDTO(doc: Record<string, unknown>): Evento {
	const raw = typeof doc.toObject === 'function' ? (doc.toObject() as Record<string, unknown>) : doc;
	const { _id, __v: _v, leadId, previousEventoId, userId, ...rest } = raw as {
		_id: unknown;
		__v?: unknown;
		leadId: unknown;
		previousEventoId?: unknown;
		userId?: unknown;
	};
	return {
		id: String(_id),
		leadId: String(leadId),
		userId: userId != null ? String(userId) : '',
		...(previousEventoId ? { previousEventoId: String(previousEventoId) } : {}),
		...(rest as Omit<Evento, 'id' | 'leadId' | 'previousEventoId' | 'userId'>),
	};
}

export const EventoModel = model('Evento', eventoSchema);
