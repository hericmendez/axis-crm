import type { FilterConfig, IncomingMessageInfo } from './message-filter.js';
import { shouldProcessMessage } from './message-filter.js';
import type { WhatsAppClient } from '../types/whatsapp.js';
import { AppError } from '../utils/errors.js';
import * as sendRateLimiter from './send-rate-limiter.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

export type WhatsAppStatus = 'desconectado' | 'aguardando_qr' | 'conectando' | 'conectado';

const state = {
	status: 'desconectado' as WhatsAppStatus,
	qr: undefined as string | undefined,
};

let client: WhatsAppClient | undefined;

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
	if (!sendRateLimiter.canSendNow()) {
		throw new AppError(429, 'Envio bloqueado temporariamente pelo limitador de taxa');
	}

	try {
		await client.sendText(chatId, text);
		sendRateLimiter.markSent();
		logger.info({ chatId }, 'Mensagem enviada');
	} catch {
		logger.error({ chatId }, 'Falha ao enviar mensagem WhatsApp');
		throw new AppError(502, 'Falha ao enviar mensagem via WhatsApp');
	}
}

export function handleIncomingMessage(msg: IncomingMessageInfo, senderName: string): void {
	const env = getEnv();
	const config: FilterConfig = {
		selfNumber: env.AXIS_NUMBER,
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

	// TODO Fase 3: encaminhar para ConversationService → AI Orchestrator
	logger.info(
		{ chatId: msg.chatId, de: senderName, texto: msg.body.slice(0, 100) },
		'Mensagem aceita para processamento',
	);
}
