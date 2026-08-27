import type {
	AppendMensagemInput,
	Conversa,
	ConversaCanal,
	ConversationContext,
	MensagemConversa,
} from '../types/conversa.js';
import { AppError } from '../utils/errors.js';
import * as conversaRepository from '../repositories/conversa.repository.js';
import * as leadRepository from '../repositories/lead.repository.js';

const RECENT_MESSAGES_DEFAULT_LIMIT = 20;
const RECENT_MESSAGES_MAX_LIMIT = 100;
const CONTEXT_MESSAGES_LIMIT = 10;
const SUMMARY_INITIAL_THRESHOLD = 20;
const SUMMARY_INCREMENTAL_THRESHOLD = 10;

export async function getOrCreate(canal: ConversaCanal, chatIdExterno: string): Promise<Conversa> {
	if (!chatIdExterno.trim()) {
		throw new AppError(400, 'chatIdExterno é obrigatório');
	}
	return conversaRepository.findOrCreateByChatExterno({ canal, chatIdExterno: chatIdExterno.trim() });
}

export async function get(id: string): Promise<Conversa> {
	const conversa = await conversaRepository.findById(id);
	if (!conversa) {
		throw new AppError(404, 'Conversa não encontrada');
	}
	return conversa;
}

export async function appendMessage(
	conversaId: string,
	input: AppendMensagemInput,
): Promise<MensagemConversa> {
	if (!input.conteudo.trim()) {
		throw new AppError(400, 'Conteúdo da mensagem é obrigatório');
	}
	const result = await conversaRepository.appendMessage(conversaId, {
		papel: input.papel,
		conteudo: input.conteudo.trim(),
	});
	if (!result) {
		throw new AppError(404, 'Conversa não encontrada');
	}
	return result.mensagem;
}

export async function getRecentMessages(
	conversaId: string,
	limit = RECENT_MESSAGES_DEFAULT_LIMIT,
): Promise<MensagemConversa[]> {
	const effectiveLimit = Math.min(Math.max(limit, 1), RECENT_MESSAGES_MAX_LIMIT);
	const conversa = await get(conversaId);
	return conversa.mensagens.slice(-effectiveLimit);
}

export async function associateLead(conversaId: string, leadId: string): Promise<Conversa> {
	const lead = await leadRepository.findById(leadId);
	if (!lead) {
		throw new AppError(404, 'Lead não encontrado');
	}
	const conversa = await conversaRepository.associateLead(conversaId, leadId);
	if (!conversa) {
		throw new AppError(404, 'Conversa não encontrada');
	}
	return conversa;
}

export async function getConversationContext(conversaId: string): Promise<ConversationContext> {
	const conversa = await get(conversaId);
	const recentMessages = conversa.mensagens.slice(-CONTEXT_MESSAGES_LIMIT);
	return {
		summary: conversa.summary,
		recentMessages,
	};
}

export function shouldUpdateSummary(conversa: Conversa): boolean {
	const messageCount = conversa.mensagens.length;
	if (!conversa.summary) {
		return messageCount >= SUMMARY_INITIAL_THRESHOLD;
	}
	const lastCount = conversa.summaryMessageCount ?? 0;
	return messageCount - lastCount >= SUMMARY_INCREMENTAL_THRESHOLD;
}

export async function updateSummary(
	conversaId: string,
	summary: string,
	summaryMessageCount: number,
): Promise<Conversa> {
	const conversa = await conversaRepository.updateSummary(conversaId, summary, summaryMessageCount);
	if (!conversa) {
		throw new AppError(404, 'Conversa não encontrada');
	}
	return conversa;
}
