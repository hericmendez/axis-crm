import type { FilterConfig, IncomingMessageInfo } from './message-filter.js';
import { shouldProcessMessage } from './message-filter.js';
import type { WhatsAppClient } from '../types/whatsapp.js';
import { AppError } from '../utils/errors.js';
import * as sendRateLimiter from './send-rate-limiter.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import * as conversaService from '../services/conversa.service.js';
import * as leadService from '../services/lead.service.js';
import * as eventoService from '../services/evento.service.js';
import * as metricasService from '../services/metricas.service.js';
import * as leadRepository from '../repositories/lead.repository.js';
import { createOrchestrator, type Orchestrator } from '../ai/orchestrator.js';
import { buildResponse } from '../ai/response-builder.js';
import { createLLMProvider } from '../ai/llm.factory.js';

export type WhatsAppStatus = 'desconectado' | 'aguardando_qr' | 'conectando' | 'conectado';

const state = {
	status: 'desconectado' as WhatsAppStatus,
	qr: undefined as string | undefined,
};

let client: WhatsAppClient | undefined;
let orchestratorInstance: Orchestrator | undefined;

export function initOrchestrator(): void {
	const llmProvider = createLLMProvider();
	orchestratorInstance = createOrchestrator({
		llmProvider,
		getRecentMessages: conversaService.getRecentMessages,
		intentRouterDeps: {
			leadService,
			eventoService,
			metricasService,
			leadRepository,
		},
	});
	logger.info('AI Orchestrator inicializado');
}

export function getStatus(): { status: WhatsAppStatus; qr: string | undefined } {
	return { ...state };
}

export function setStatus(status: WhatsAppStatus): void {
	state.status = status;
	logger.info({ status }, 'WhatsApp status');
}

export function setQr(qr: string | undefined): void {
	state.qr = qr;
	if (qr) state.status = 'aguardando_qr';
}

export function setClient(whatsappClient: WhatsAppClient): void {
	client = whatsappClient;
}

export function clearClient(): void {
	client = undefined;
}

export async function sendMessage(chatId: string, text: string): Promise<void> {
	if (!client) {
		throw new AppError(503, 'WhatsApp não inicializado');
	}
	if (state.status !== 'conectado') {
		throw new AppError(503, 'WhatsApp não está conectado');
	}
	if (!chatId.trim() || !text.trim()) {
		throw new AppError(400, 'chatId e texto são obrigatórios');
	}
	const release = sendRateLimiter.tryAcquire();
	if (!release) {
		throw new AppError(429, 'Envio bloqueado temporariamente pelo limitador de taxa');
	}

	try {
		await client.sendText(chatId, text);
		logger.info({ chatId }, 'Mensagem enviada');
	} catch {
		release();
		logger.error({ chatId }, 'Falha ao enviar mensagem WhatsApp');
		throw new AppError(502, 'Falha ao enviar mensagem via WhatsApp');
	}
}

export async function handleIncomingMessage(
	msg: IncomingMessageInfo,
	senderName: string,
): Promise<void> {
	const env = getEnv();
	const config: FilterConfig = {
		selfIds: [env.AXIS_NUMBER, env.WHATSAPP_SELF_LID]
			.filter((id): id is string => Boolean(id)),
		allowedGroups: (env.WHATSAPP_ALLOWED_GROUPS ?? '')
			.split(',')
			.map((g) => g.trim())
			.filter(Boolean),
	};

	const decision = shouldProcessMessage(msg, config);
	if (!decision.process) {
		logger.debug({ chatId: msg.chatId, reason: decision.reason }, 'Mensagem ignorada');
		return;
	}

	// Mensagens rejeitadas NUNCA chegam aqui: nenhuma conversa é criada/persistida.
	const conversa = await conversaService.getOrCreate('whatsapp', msg.chatId);
	await conversaService.appendMessage(conversa.id, { papel: 'usuario', conteudo: msg.body });

	logger.info(
		{ chatId: msg.chatId, de: senderName, conversaId: conversa.id, texto: msg.body.slice(0, 100) },
		'Mensagem aceita e persistida na conversa',
	);

	if (!orchestratorInstance) {
		logger.warn({ chatId: msg.chatId }, 'Orchestrator não inicializado; mensagem ignorada');
		return;
	}

	const result = await orchestratorInstance.processMessage(conversa.id, msg.body);
	const responseText = buildResponse(result);

	await conversaService.appendMessage(conversa.id, { papel: 'axis', conteudo: responseText });

	try {
		await sendMessage(msg.chatId, responseText);
	} catch (err) {
		logger.error({ chatId: msg.chatId, err }, 'Falha ao enviar resposta via WhatsApp');
	}
}
