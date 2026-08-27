import type {
	ChatMessage,
	CompletionRequest,
	StructuredOutput,
} from '../../types/ai.js';
import { structuredOutputSchema } from '../../types/ai.js';
import { AppError } from '../../utils/errors.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TIMEOUT_MS = 30_000;

export interface GroqConfig {
	apiKey: string;
	model: string;
}

interface GroqChoice {
	message?: { content?: string };
}

interface GroqResponse {
	choices?: GroqChoice[];
}

const SYSTEM_PROMPT = `Você é o Axis, assistente comercial de um CRM via WhatsApp.
Responda SEMPRE e APENAS com um JSON válido, sem markdown, no formato:

Para ações:
{"mode":"ACTION","intent":"...","confidence":0.0,"parameters":{}}
Intents possíveis: CRIAR_LEAD, ATUALIZAR_LEAD, CONSULTAR_AGENDA, REGISTRAR_EVENTO.

Para conversa:
{"mode":"CHAT","confidence":0.0,"response":"..."}`;

function extractJson(content: string): unknown {
	const trimmed = content.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
	try {
		return JSON.parse(trimmed);
	} catch {
		const start = trimmed.indexOf('{');
		const end = trimmed.lastIndexOf('}');
		if (start !== -1 && end > start) {
			return JSON.parse(trimmed.slice(start, end + 1));
		}
		throw new Error('Resposta do LLM não contém JSON');
	}
}

export async function complete(
	config: GroqConfig,
	request: CompletionRequest,
): Promise<StructuredOutput> {
	const messages: ChatMessage[] = [
		{ role: 'system', content: request.systemPrompt ?? SYSTEM_PROMPT },
		...request.messages,
	];

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetch(GROQ_URL, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${config.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: config.model,
				messages,
				temperature: 0.1,
				response_format: { type: 'json_object' },
			}),
			signal: controller.signal,
		});
	} catch (err) {
		throw new AppError(502, 'Falha ao comunicar com o provedor de LLM', { cause: err });
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) {
		throw new AppError(502, `Provedor de LLM respondeu ${response.status}`);
	}

	const body = (await response.json()) as GroqResponse;
	const content = body.choices?.[0]?.message?.content;
	if (!content) {
		throw new AppError(502, 'Resposta vazia do provedor de LLM');
	}

	const parsed = structuredOutputSchema.safeParse(extractJson(content));
	if (!parsed.success) {
		throw new AppError(502, 'Saída do LLM inválida');
	}
	return parsed.data;
}
