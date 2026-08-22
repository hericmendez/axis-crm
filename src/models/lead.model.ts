import { Schema, model } from 'mongoose';
import { LEAD_STATUS, type Lead } from '../types/lead.js';

const leadSchema = new Schema(
	{
		nome: { type: String, required: true, trim: true },
		telefone: { type: String, required: true, unique: true },
		email: { type: String, lowercase: true, trim: true },
		contatoOrigem: { type: String, required: true, trim: true },
		senioridade: { type: String, trim: true },
		renda: { type: Number, min: 0 },
		status: { type: String, enum: [...LEAD_STATUS] },
		dataAgendamento: Date,
		dataConversao: Date,
		tipoFechamento: { type: String, trim: true },
		observacoes: { type: String, trim: true },
		ultimaInteracao: Date,
	},
	{ timestamps: true },
);

export function toLeadDTO(doc: { _id: unknown; __v?: unknown } & object): Lead {
	const { _id, __v: _v, ...rest } = doc;
	return {
		id: String(_id),
		...(rest as Omit<Lead, 'id'>),
	};
}

export const LeadModel = model<Lead>('Lead', leadSchema);
