import type { LLMProvider, ChatMessage, StructuredOutput } from '../types/ai.js';
import { structuredOutputSchema } from '../types/ai.js';
import type { MensagemConversa } from '../types/conversa.js';
import { routeIntent, type IntentRouterDeps } from './intent-router.js';
import type { OrchestratorResult } from './errors.js';
import { logger } from '../utils/logger.js';

const CONTEXT_LIMIT = 10;

export interface OrchestratorDeps {
	llmProvider: LLMProvider;
	getRecentMessages: (conversaId: string, limit?: number) => Promise<MensagemConversa[]>;
	intentRouterDeps: IntentRouterDeps;
}

function toChatMessages(messages: MensagemConversa[], userMessage: string): ChatMessage[] {
	const history: ChatMessage[] = messages.map((m) => ({
		role: m.papel === 'axis' ? 'assistant' : 'user',
		content: m.conteudo,
	}));
	history.push({ role: 'user', content: userMessage });
	return history;
}

export interface Orchestrator {
	processMessage: (conversaId: string, userMessage: string) => Promise<OrchestratorResult>;
}

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
	async function processMessage(
		conversaId: string,
		userMessage: string,
	): Promise<OrchestratorResult> {
		let recentMessages: MensagemConversa[];
		try {
			recentMessages = await deps.getRecentMessages(conversaId, CONTEXT_LIMIT);
		} catch (err) {
			logger.error({ err, conversaId }, 'Falha ao buscar mensagens da conversa');
			return {
				type: 'INFRASTRUCTURE_ERROR',
				message: 'Erro ao acessar histórico da conversa.',
			};
		}

		const chatMessages = toChatMessages(recentMessages, userMessage);

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

		const result = await routeIntent(output, deps.intentRouterDeps);

		if (result.type === 'SERVICE_ERROR') {
			logger.error({ result, conversaId }, 'Erro de serviço ao processar intent');
		}

		return result;
	}

	return { processMessage };
}
