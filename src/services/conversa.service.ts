import type {
	AppendMensagemInput,
	Conversa,
	ConversaCanal,
	ConversationContext,
	MensagemConversa,
} from '../types/conversa.js';
import { AppError } from '../utils/errors.js';
import * as conversaRepository from '../repositories/conversa.repository.js';
import type { ConversaListFilter } from '../repositories/conversa.repository.js';
import type { PaginatedResult, PaginationParams } from '../types/lead.js';
import * as leadRepository from '../repositories/lead.repository.js';
import { requireTenant } from './tenant.js';

const RECENT_MESSAGES_DEFAULT_LIMIT = 20;
const RECENT_MESSAGES_MAX_LIMIT = 100;
const CONTEXT_MESSAGES_LIMIT = 10;
const SUMMARY_INITIAL_THRESHOLD = 20;
const SUMMARY_INCREMENTAL_THRESHOLD = 10;

export async function getOrCreate(
	userId: string | undefined,
	canal: ConversaCanal,
	chatIdExterno: string,
): Promise<Conversa> {
	const tenant = requireTenant(userId);
	if (!chatIdExterno.trim()) {
		throw new AppError(400, 'chatIdExterno é obrigatório');
	}
	return conversaRepository.findOrCreateByChatExterno({
		userId: tenant,
		canal,
		chatIdExterno: chatIdExterno.trim(),
	});
}

export async function get(userId: string | undefined, id: string): Promise<Conversa> {
	const tenant = requireTenant(userId);
	const conversa = await conversaRepository.findById(tenant, id);
	if (!conversa) {
		throw new AppError(404, 'Conversa não encontrada');
	}
	return conversa;
}

export async function list(
	userId: string | undefined,
	filter: ConversaListFilter,
	pagination: PaginationParams,
): Promise<PaginatedResult<Conversa>> {
	const tenant = requireTenant(userId);
	return conversaRepository.findByFilter(tenant, filter, pagination);
}

// Bounded detail view for the panel: metadata + at most `messageLimit`
// recent messages. Full unbounded history is never returned over HTTP.
export async function getDetail(
	userId: string | undefined,
	id: string,
	messageLimit = 50,
): Promise<Conversa> {
	const effectiveLimit = Math.min(Math.max(messageLimit, 1), 200);
	const conversa = await get(userId, id);
	return { ...conversa, mensagens: conversa.mensagens.slice(-effectiveLimit) };
}

export async function appendMessage(
	userId: string | undefined,
	conversaId: string,
	input: AppendMensagemInput,
): Promise<MensagemConversa> {
	const tenant = requireTenant(userId);
	if (!input.conteudo.trim()) {
		throw new AppError(400, 'Conteúdo da mensagem é obrigatório');
	}
	const result = await conversaRepository.appendMessage(tenant, conversaId, {
		papel: input.papel,
		conteudo: input.conteudo.trim(),
	});
	if (!result) {
		throw new AppError(404, 'Conversa não encontrada');
	}
	return result.mensagem;
}

export async function getRecentMessages(
	userId: string | undefined,
	conversaId: string,
	limit = RECENT_MESSAGES_DEFAULT_LIMIT,
): Promise<MensagemConversa[]> {
	const effectiveLimit = Math.min(Math.max(limit, 1), RECENT_MESSAGES_MAX_LIMIT);
	const conversa = await get(userId, conversaId);
	return conversa.mensagens.slice(-effectiveLimit);
}

export async function associateLead(
	userId: string | undefined,
	conversaId: string,
	leadId: string,
): Promise<Conversa> {
	const tenant = requireTenant(userId);
	const lead = await leadRepository.findById(tenant, leadId);
	if (!lead) {
		throw new AppError(404, 'Lead não encontrado');
	}
	const conversa = await conversaRepository.associateLead(tenant, conversaId, leadId);
	if (!conversa) {
		throw new AppError(404, 'Conversa não encontrada');
	}
	return conversa;
}

export async function getConversationContext(
	userId: string | undefined,
	conversaId: string,
): Promise<ConversationContext> {
	const conversa = await get(userId, conversaId);
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
	userId: string | undefined,
	conversaId: string,
	summary: string,
	summaryMessageCount: number,
): Promise<Conversa> {
	const tenant = requireTenant(userId);
	const conversa = await conversaRepository.updateSummary(tenant, conversaId, summary, summaryMessageCount);
	if (!conversa) {
		throw new AppError(404, 'Conversa não encontrada');
	}
	return conversa;
}
