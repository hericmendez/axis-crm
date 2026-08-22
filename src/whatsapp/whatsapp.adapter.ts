import { Client, LocalAuth, type Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import * as whatsappService from './whatsapp.service.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

let client: Client | undefined;

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

	client.on('loading_screen', () => whatsappService.setStatus('conectando'));
	client.on('ready', () => {
		whatsappService.setQr(undefined);
		whatsappService.setStatus('conectado');
	});
	client.on('disconnected', (reason: string) => {
		whatsappService.setStatus('desconectado');
		logger.warn({ reason }, 'WhatsApp desconectado');
	});

	client.on('message_create', async (msg: Message) => {
		try {
			const chat = await msg.getChat();
			const contact = await msg.getContact();
			whatsappService.handleIncomingMessage(
				{
					fromMe: msg.fromMe,
					isGroup: chat.isGroup,
					chatId: chat.id._serialized,
					body: msg.body,
					hasMention: (msg.mentionedIds ?? []).length > 0,
					mentionedNumbers: (msg.mentionedIds ?? []).map(String),
				},
				contact.pushname ?? contact.number,
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
		whatsappService.setStatus('desconectado');
	}
}
