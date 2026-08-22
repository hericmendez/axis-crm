import type { LLMProvider } from '../types/ai.js';
import { getEnv } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import * as groqProvider from './providers/groq.provider.js';

export function createLLMProvider(): LLMProvider {
	const env = getEnv();

	switch (env.LLM_PROVIDER) {
		case 'groq': {
			if (!env.GROQ_API_KEY) {
				throw new Error('LLM_PROVIDER=groq requer GROQ_API_KEY');
			}
			return {
				complete: (request) =>
					groqProvider.complete(
						{ apiKey: env.GROQ_API_KEY as string, model: env.GROQ_MODEL },
						request,
					),
			};
		}
		case 'ollama':
			throw new AppError(
				500,
				'Adapter Ollama ainda não implementado (planejado para a Fase 3)',
			);
	}
}
