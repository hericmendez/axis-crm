import type { LLMProvider, ChatMessage, StructuredOutput } from '../types/ai.js';
import { structuredOutputSchema } from '../types/ai.js';
import type { ConversationContext, Conversa } from '../types/conversa.js';
import { routeIntent, type IntentRouterDeps } from './intent-router.js';
import type { OrchestratorResult } from './errors.js';
import { logger } from '../utils/logger.js';

export interface OrchestratorDeps {
	llmProvider: LLMProvider;
	getConversationContext: (userId: string | undefined, conversaId: string) => Promise<ConversationContext>;
	intentRouterDeps: IntentRouterDeps;
	conversaService: {
		get: (userId: string | undefined, id: string) => Promise<Conversa>;
		associateLead: (userId: string | undefined, conversaId: string, leadId: string) => Promise<Conversa>;
	};
}

function toChatMessages(context: ConversationContext, userMessage: string): ChatMessage[] {
	const chatMessages: ChatMessage[] = [];

	if (context.summary) {
		chatMessages.push({
			role: 'system',
			content: `Resumo da conversa até o momento:\n${context.summary}`,
		});
	}

	const priorMessages = context.recentMessages.slice(0, -1);
	for (const m of priorMessages) {
		chatMessages.push({
			role: m.papel === 'axis' ? 'assistant' : 'user',
			content: m.conteudo,
		});
	}

	chatMessages.push({ role: 'user', content: userMessage });
	return chatMessages;
}

export interface Orchestrator {
	processMessage: (conversaId: string, userMessage: string, userId?: string) => Promise<OrchestratorResult>;
}

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
	async function processMessage(
		conversaId: string,
		userMessage: string,
		userId?: string,
	): Promise<OrchestratorResult> {
		let context: ConversationContext;
		try {
			context = await deps.getConversationContext(userId, conversaId);
		} catch (err) {
			logger.error({ err, conversaId }, 'Falha ao buscar contexto da conversa');
			return {
				type: 'INFRASTRUCTURE_ERROR',
				message: 'Erro ao acessar histórico da conversa.',
			};
		}

		const chatMessages = toChatMessages(context, userMessage);

		let output: StructuredOutput;
		try {
			const raw = await deps.llmProvider.complete({ messages: chatMessages });
			const parsed = structuredOutputSchema.safeParse(raw);
			if (!parsed.success) {
				logger.error({ errors: parsed.error.issues, conversaId }, 'Saída do LLM inválida');
				return {
					type: 'LLM_ERROR',
					message: 'Resposta do LLM inválida.',
				};
			}
			output = parsed.data;
		} catch (err) {
			logger.error({ err, conversaId }, 'Falha ao comunicar com o LLM');
			return {
				type: 'LLM_ERROR',
				message: 'Falha ao processar com o provedor de IA.',
			};
		}

		const result = await routeIntent(output, deps.intentRouterDeps, userMessage, userId);

		if (result.type === 'SERVICE_ERROR') {
			logger.error({ result, conversaId }, 'Erro de serviço ao processar intent');
		}

		if (result.type === 'SUCCESS' && result.leadId) {
			try {
				const conversa = await deps.conversaService.get(userId, conversaId);
				if (!conversa.leadId) {
					await deps.conversaService.associateLead(userId, conversaId, result.leadId);
					logger.info({ conversaId, leadId: result.leadId }, 'Conversa vinculada ao lead');
				}
			} catch (err) {
				logger.error({ err, conversaId, leadId: result.leadId }, 'Falha ao vincular conversa ao lead');
			}
		}

		return result;
	}

	return { processMessage };
}
