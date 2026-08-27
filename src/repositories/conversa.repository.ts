import type {
	AppendMensagemInput,
	Conversa,
	CreateConversaInput,
	MensagemConversa,
} from '../types/conversa.js';
import { ConversaModel, toConversaDTO } from '../models/conversa.model.js';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export async function findOrCreateByChatExterno(input: CreateConversaInput): Promise<Conversa> {
	const doc = await ConversaModel.findOneAndUpdate(
		{ canal: input.canal, chatIdExterno: input.chatIdExterno },
		{ $setOnInsert: { canal: input.canal, chatIdExterno: input.chatIdExterno } },
		{ upsert: true, new: true, setDefaultsOnInsert: true },
	).lean();
	return toConversaDTO(doc as Record<string, unknown>);
}

export async function findById(id: string): Promise<Conversa | null> {
	if (!OBJECT_ID_RE.test(id)) return null;
	const doc = await ConversaModel.findById(id).lean();
	return doc ? toConversaDTO(doc) : null;
}

export async function appendMessage(
	id: string,
	input: AppendMensagemInput,
): Promise<{ conversa: Conversa; mensagem: MensagemConversa } | null> {
	if (!OBJECT_ID_RE.test(id)) return null;
	const doc = await ConversaModel.findByIdAndUpdate(
		id,
		{
			$push: { mensagens: { conteudo: input.conteudo, papel: input.papel } },
			$set: { updatedAt: new Date() },
		},
		{ new: true },
	).lean();
	if (!doc) return null;
	const conversa = toConversaDTO(doc);
	const mensagem = conversa.mensagens.at(-1);
	if (!mensagem) return null;
	return { conversa, mensagem };
}

export async function associateLead(id: string, leadId: string): Promise<Conversa | null> {
	if (!OBJECT_ID_RE.test(id) || !OBJECT_ID_RE.test(leadId)) return null;
	const doc = await ConversaModel.findByIdAndUpdate(
		id,
		{ $set: { leadId } },
		{ new: true },
	).lean();
	return doc ? toConversaDTO(doc) : null;
}

export async function updateSummary(
	id: string,
	summary: string,
	summaryMessageCount: number,
): Promise<Conversa | null> {
	if (!OBJECT_ID_RE.test(id)) return null;
	const doc = await ConversaModel.findByIdAndUpdate(
		id,
		{
			$set: {
				summary,
				summaryMessageCount,
				summaryUpdatedAt: new Date(),
			},
		},
		{ new: true },
	).lean();
	return doc ? toConversaDTO(doc) : null;
}
