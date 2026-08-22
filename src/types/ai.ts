import { z } from 'zod';

export const EVENTO_TIPOS = [
	'AGENDAMENTO',
	'REAGENDAMENTO',
	'VENDA',
	'DESISTENCIA',
	'NO_SHOW',
] as const;

export type EventoTipo = (typeof EVENTO_TIPOS)[number];

export const INTENTS = [
	'CRIAR_LEAD',
	'ATUALIZAR_LEAD',
	'CONSULTAR_AGENDA',
	'REGISTRAR_EVENTO',
	'CONVERSAR',
] as const;

export type Intent = (typeof INTENTS)[number];

export const structuredOutputSchema = z.union([
	z.object({
		mode: z.literal('ACTION'),
		intent: z.enum(INTENTS),
		confidence: z.number().min(0).max(1),
		parameters: z.record(z.string(), z.unknown()).default({}),
	}),
	z.object({
		mode: z.literal('CHAT'),
		confidence: z.number().min(0).max(1),
		response: z.string().min(1),
	}),
]);

export type StructuredOutput = z.infer<typeof structuredOutputSchema>;

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface CompletionRequest {
	messages: ChatMessage[];
}

export interface LLMProvider {
	complete(request: CompletionRequest): Promise<StructuredOutput>;
}
