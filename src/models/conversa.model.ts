import { Schema, model } from 'mongoose';
import {
	CONVERSA_CANAIS,
	MENSAGEM_PAPES,
	type Conversa,
	type MensagemConversa,
} from '../types/conversa.js';

const mensagemSchema = new Schema(
	{
		papel: { type: String, enum: [...MENSAGEM_PAPES], required: true },
		conteudo: { type: String, required: true, trim: true },
	},
	{ _id: true, timestamps: { createdAt: true, updatedAt: false } },
);

const conversaSchema = new Schema(
	{
		canal: { type: String, enum: [...CONVERSA_CANAIS], required: true },
		chatIdExterno: { type: String, required: true, trim: true },
		leadId: { type: Schema.Types.ObjectId, ref: 'Lead' },
		mensagens: { type: [mensagemSchema], default: [] },
	},
	{ timestamps: true },
);

conversaSchema.index({ canal: 1, chatIdExterno: 1 }, { unique: true });

function toMensagemDTO(doc: Record<string, unknown>): MensagemConversa {
	const raw = doc as { _id: unknown; createdAt?: unknown; papel: string; conteudo: string };
	return {
		id: String(raw._id),
		papel: raw.papel as MensagemConversa['papel'],
		conteudo: raw.conteudo,
		criadoEm: (raw.createdAt as Date) ?? new Date(0),
	};
}

export function toConversaDTO(doc: Record<string, unknown>): Conversa {
	const raw = typeof doc.toObject === 'function' ? (doc.toObject() as Record<string, unknown>) : doc;
	const { _id, __v: _v, mensagens, leadId, ...rest } = raw as {
		_id: unknown;
		__v?: unknown;
		mensagens?: Record<string, unknown>[];
		leadId?: unknown;
	};
	return {
		id: String(_id),
		...(leadId ? { leadId: String(leadId) } : {}),
		mensagens: (mensagens ?? []).map(toMensagemDTO),
		...(rest as Omit<Conversa, 'id' | 'mensagens' | 'leadId'>),
	};
}

export const ConversaModel = model('Conversa', conversaSchema);
