import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import * as whatsappService from '../../src/whatsapp/whatsapp.service.js';
import type { IncomingMessageInfo } from '../../src/whatsapp/message-filter.js';

function msg(partial: Partial<IncomingMessageInfo>): IncomingMessageInfo {
	return {
		fromMe: false,
		isGroup: false,
		chatId: '5511999999999@c.us',
		body: 'olá',
		hasMention: false,
		mentionedNumbers: [],
		...partial,
	};
}

describe('integração WhatsApp → AI Orchestrator', () => {
	beforeAll(async () => {
		const uri = await startTestMongo();
		await mongoose.connect(uri);
	});

	beforeEach(async () => {
		await clearCollections();
	});

	afterAll(async () => {
		await stopTestMongo();
	});

	it('orchestrator não inicializado: mensagem é persistida mas sem resposta', async () => {
		await whatsappService.handleIncomingMessage(
			msg({ body: 'Olá Axis' }),
			'Maria',
		);

		const { ConversaModel } = await import('../../src/models/conversa.model.js');
		const conversa = await ConversaModel.findOne({ chatIdExterno: '5511999999999@c.us' }).lean();
		expect(conversa).not.toBeNull();
		const msgs = (conversa?.mensagens ?? []).map((m: { papel: string; conteudo: string }) => ({
			papel: m.papel,
			conteudo: m.conteudo,
		}));
		expect(msgs).toHaveLength(1);
		expect(msgs[0].papel).toBe('usuario');
	});

	it('mensagem própria continua sendo ignorada', async () => {
		await whatsappService.handleIncomingMessage(msg({ fromMe: true }), 'Axis');

		const { ConversaModel } = await import('../../src/models/conversa.model.js');
		const conversa = await ConversaModel.findOne({ chatIdExterno: '5511999999999@c.us' }).lean();
		expect(conversa).toBeNull();
	});

	it('mensagem de grupo sem menção continua sendo ignorada', async () => {
		await whatsappService.handleIncomingMessage(
			msg({ isGroup: true, chatId: 'grupo@g.us' }),
			'Maria',
		);

		const { ConversaModel } = await import('../../src/models/conversa.model.js');
		const conversa = await ConversaModel.findOne({ chatIdExterno: 'grupo@g.us' }).lean();
		expect(conversa).toBeNull();
	});
});
