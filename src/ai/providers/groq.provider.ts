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

const SYSTEM_PROMPT_TEMPLATE = `Você é o Axis, assistente comercial de um CRM via WhatsApp.
Data e hora atuais: {CURRENT_DATETIME}
Responda SEMPRE e APENAS com um JSON válido, sem markdown, no formato:

Para ações:
{"mode":"ACTION","intent":"...","confidence":0.0,"parameters":{}}
Para conversa:
{"mode":"CHAT","confidence":0.0,"response":"..."}

Intents e parâmetros:

CRIAR_LEAD — cria um novo lead
  parameters: {"nome":"...","telefone":"..."}
  Obrigatórios: nome, telefone

ATUALIZAR_LEAD — atualiza dados de um lead existente
  parameters: {"leadRef":"...","leadId":"...","telefone":"...","nome":"...","status":"...","email":"...","senioridade":"...","renda":"...","observacoes":"..."}
  Pelo menos uma referência ao lead: leadId, telefone ou leadRef (nome do lead)

CONSULTAR_AGENDA — consulta agendamentos
  parameters: {"de":"...","ate":"..."}
  Opcional: datas no formato ISO

REGISTRAR_EVENTO — registra um evento para um lead
  parameters: {"leadRef":"...","leadId":"...","telefone":"...","tipo":"...","data":"...","observacoes":"..."}
  Pelo menos uma referência ao lead: leadId, telefone ou leadRef (nome do lead)
  Obrigatório: tipo
  Tipo aceita apenas: AGENDAMENTO, REAGENDAMENTO, VENDA, DESISTENCIA, NO_SHOW
  Mapeamento de linguagem natural:
    "Call" / "ligação" / "agendar" / "agendamento" → AGENDAMENTO
    "Reunião" / "meeting" → AGENDAMENTO
    "Demo" / "demonstração" → AGENDAMENTO
    "Visita" → AGENDAMENTO
    "Venda" / "vendeu" / "comprou" → VENDA
    "Desistiu" / "cancelou" / "perdeu" → DESISTENCIA
    "Reagendou" / "reagendar" → REAGENDAMENTO
    "Não compareceu" / "no-show" → NO_SHOW
  data: SEMPRE extraia a data e hora quando mencionadas. Converta expressões relativas usando a data/hora atual fornecida acima.
    "amanhã às 10h" → data de amanhã às 10:00 em formato ISO
    "próxima segunda às 14h" → data da próxima segunda-feira às 14:00 em formato ISO
    "sexta às 15h" → data da próxima sexta-feira às 15:00 em formato ISO
    "dia 31 às 14:30" → dia 31 do mês atual às 14:30 em formato ISO
    "depois de amanhã às 9" → dois dias a partir de hoje às 09:00 em formato ISO
    Se não conseguir determinar a data, não inclua o campo data.
    IMPORTANTE: Para AGENDAMENTO e REAGENDAMENTO, extraia data sempre que o usuário fornecer uma data/hora. Nunca invente uma data.

Referências a leads:
  Use leadRef quando o usuário mencionar um nome de pessoa (ex: "Pedro Lucas")
  Use leadId quando o usuário mencionar um ID (ex: "Lead 101" → leadId: "101")
  Use telefone quando o usuário mencionar um número (ex: "16999999999")
  Se o texto contiver um nome de pessoa, SEMPRE extraia como leadRef

Exemplos:
  "agende uma Call com Pedro Lucas para segunda às 14h"
  → {"mode":"ACTION","intent":"REGISTRAR_EVENTO","confidence":0.95,"parameters":{"leadRef":"Pedro Lucas","tipo":"AGENDAMENTO","data":"2026-08-31T14:00:00"}}

  "agende uma Call para o Lead 101 para segunda às 14h"
  → {"mode":"ACTION","intent":"REGISTRAR_EVENTO","confidence":0.95,"parameters":{"leadId":"101","tipo":"AGENDAMENTO","data":"2026-08-31T14:00:00"}}

  "registre uma venda para o lead 101"
  → {"mode":"ACTION","intent":"REGISTRAR_EVENTO","confidence":0.95,"parameters":{"leadId":"101","tipo":"VENDA"}}`;

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

function buildSystemPrompt(request: CompletionRequest): string {
	const template = request.systemPrompt ?? SYSTEM_PROMPT_TEMPLATE;
	const now = new Date();
	const datetime = now.toLocaleString('pt-BR', {
		timeZone: 'America/Sao_Paulo',
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
	return template.replace('{CURRENT_DATETIME}', datetime);
}

export async function complete(
	config: GroqConfig,
	request: CompletionRequest,
): Promise<StructuredOutput> {
	const messages: ChatMessage[] = [
		{ role: 'system', content: buildSystemPrompt(request) },
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
