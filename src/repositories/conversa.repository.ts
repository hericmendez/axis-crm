import type {
	AppendMensagemInput,
	Conversa,
	ConversaCanal,
	CreateConversaInput,
	MensagemConversa,
} from '../types/conversa.js';
import type { PaginatedResult, PaginationParams } from '../types/lead.js';
import { ConversaModel, toConversaDTO } from '../models/conversa.model.js';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

function assertTenant(userId: string | undefined): boolean {
	return typeof userId === 'string' && OBJECT_ID_RE.test(userId);
}

export async function findOrCreateByChatExterno(input: CreateConversaInput): Promise<Conversa> {
	const doc = await ConversaModel.findOneAndUpdate(
		{ userId: input.userId, canal: input.canal, chatIdExterno: input.chatIdExterno },
		{ $setOnInsert: { userId: input.userId, canal: input.canal, chatIdExterno: input.chatIdExterno } },
		{ upsert: true, new: true, setDefaultsOnInsert: true },
	).lean();
	return toConversaDTO(doc as Record<string, unknown>);
}

export async function findById(userId: string | undefined, id: string): Promise<Conversa | null> {
	if (!assertTenant(userId) || !OBJECT_ID_RE.test(id)) return null;
	const doc = await ConversaModel.findOne({ _id: id, userId }).lean();
	return doc ? toConversaDTO(doc) : null;
}

export async function appendMessage(
	userId: string | undefined,
	id: string,
	input: AppendMensagemInput,
): Promise<{ conversa: Conversa; mensagem: MensagemConversa } | null> {
	if (!assertTenant(userId) || !OBJECT_ID_RE.test(id)) return null;
	const doc = await ConversaModel.findOneAndUpdate(
		{ _id: id, userId },
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

export async function associateLead(
	userId: string | undefined,
	id: string,
	leadId: string,
): Promise<Conversa | null> {
	if (!assertTenant(userId) || !OBJECT_ID_RE.test(id) || !OBJECT_ID_RE.test(leadId)) return null;
	const doc = await ConversaModel.findOneAndUpdate(
		{ _id: id, userId },
		{ $set: { leadId } },
		{ new: true },
	).lean();
	return doc ? toConversaDTO(doc) : null;
}

export interface ConversaListFilter {
	leadId?: string;
	canal?: ConversaCanal;
	chatIdExterno?: string;
}

export async function findByFilter(
	userId: string | undefined,
	filter: ConversaListFilter,
	pagination: PaginationParams,
): Promise<PaginatedResult<Conversa>> {
	const { page, limit } = pagination;
	if (!assertTenant(userId)) return { items: [], total: 0, page, limit };
	if (filter.leadId && !OBJECT_ID_RE.test(filter.leadId)) return { items: [], total: 0, page, limit };
	const scoped = { ...filter, userId };
	const [docs, total] = await Promise.all([
		ConversaModel.find(scoped)
			.sort({ updatedAt: -1 })
			.skip((page - 1) * limit)
			.limit(limit)
			.lean(),
		ConversaModel.countDocuments(scoped),
	]);
	return { items: docs.map((d) => toConversaDTO(d)), total, page, limit };
}

export async function updateSummary(
	userId: string | undefined,
	id: string,
	summary: string,
	summaryMessageCount: number,
): Promise<Conversa | null> {
	if (!assertTenant(userId) || !OBJECT_ID_RE.test(id)) return null;
	const doc = await ConversaModel.findOneAndUpdate(
		{ _id: id, userId },
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
