import wwjs, { type Message } from 'whatsapp-web.js';
const { Client, LocalAuth } = wwjs;
import qrcode from 'qrcode-terminal';
import type { WhatsAppClient } from '../types/whatsapp.js';
import * as whatsappService from './whatsapp.service.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

let client: InstanceType<typeof Client> | undefined;

const whatsappClientAdapter: WhatsAppClient = {
	async sendText(chatId: string, text: string): Promise<void> {
		if (!client) {
			throw new Error('WhatsApp client não inicializado');
		}
		await client.sendMessage(chatId, text);
	},
};

export async function start(): Promise<void> {
	const env = getEnv();
	const sessionPath = env.WHATSAPP_SESSION_PATH ?? '.wwebjs_auth';

	client = new Client({
		authStrategy: new LocalAuth({ dataPath: sessionPath }),
		puppeteer: { headless: true },
	});

	client.on('qr', (qr: string) => {
		qrcode.generate(qr, { small: true });
		whatsappService.setQr(qr);
	});

	client.on('loading_screen', () => {
		// O loading_screen pode disparar depois do ready (sincronização de histórico);
		// não rebaixa o status se já estamos conectados.
		if (whatsappService.getStatus().status !== 'conectado') {
			whatsappService.setStatus('conectando');
		}
	});
	client.on('ready', () => {
		// Identidade da sessão autenticada (número do próprio client).
		logger.info({ wid: client?.info?.wid?.user }, 'WhatsApp autenticado como');
		whatsappService.setQr(undefined);
		whatsappService.setStatus('conectado');
		whatsappService.setClient(whatsappClientAdapter);
	});
	client.on('disconnected', (reason: string) => {
		whatsappService.clearClient();
		whatsappService.setStatus('desconectado');
		logger.warn({ reason }, 'WhatsApp desconectado');
	});

	// Não usa msg.getChat()/getContact(): em whatsapp-web.js + Puppeteer 24 esses
	// métodos falham com erro de ExecutionContext. O chat real está em
	// msg.id.remote (JID do chat; @g.us = grupo) e o remetente em
	// msg.id.participant/author — msg.from/to não são confiáveis com endereçamento LID.

	client.on('message_create', (msg: Message) => {
		try {
			const chatId = msg.id.remote || msg.to;
			whatsappService.handleIncomingMessage(
				{
					fromMe: msg.fromMe,
					// Com endereçamento LID o chat de grupo pode não terminar em @g.us;
					// msg.author só existe em mensagens de grupo.
					isGroup: chatId.endsWith('@g.us') || msg.author !== undefined,
					chatId,
					body: msg.body,
					hasMention: (msg.mentionedIds ?? []).length > 0,
					mentionedNumbers: (msg.mentionedIds ?? []).map(String),
				},
				String(msg.author ?? (msg.id as { participant?: string }).participant ?? msg.from),
			);
		} catch (err) {
			logger.error({ err }, 'Falha ao processar mensagem recebida');
		}
	});

	await client.initialize();
}

export async function stop(): Promise<void> {
	if (client) {
		await client.destroy();
		client = undefined;
		whatsappService.clearClient();
		whatsappService.setStatus('desconectado');
	}
}
