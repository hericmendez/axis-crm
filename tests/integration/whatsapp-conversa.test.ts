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

describe('integração WhatsApp → ConversationService', () => {
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

	it('mensagem privada aceita cria conversa com o chatId externo do WhatsApp', async () => {
		await whatsappService.handleIncomingMessage(
			msg({ body: 'oi Axis' }),
			'Maria',
		);

		const conversa = await conversaPorChat('5511999999999@c.us');
		expect(conversa).not.toBeNull();
		expect(conversa?.canal).toBe('whatsapp');
		expect(conversa?.mensagens).toHaveLength(1);
		expect(conversa?.mensagens[0]).toMatchObject({
			papel: 'usuario',
			conteudo: 'oi Axis',
		});
	});

	it('múltiplas mensagens do mesmo chat reaproveitam a mesma conversa', async () => {
		await whatsappService.handleIncomingMessage(msg({ body: 'primeira' }), 'Maria');
		await whatsappService.handleIncomingMessage(msg({ body: 'segunda' }), 'Maria');

		const dm = await conversaPorChat('5511999999999@c.us');
		expect(dm?.mensagens.map((m) => m.conteudo)).toEqual(['primeira', 'segunda']);
	});

	it('mensagem rejeitada (própria) não cria conversa nem persiste mensagem', async () => {
		await whatsappService.handleIncomingMessage(msg({ fromMe: true }), 'Axis');

		expect(await conversaPorChat('5511999999999@c.us')).toBeNull();
	});

	it('mensagem de grupo sem menção não é persistida', async () => {
		await whatsappService.handleIncomingMessage(
			msg({ isGroup: true, chatId: 'grupo-sem-mensagem@g.us' }),
			'Maria',
		);

		expect(await conversaPorChat('grupo-sem-mensagem@g.us')).toBeNull();
	});
});

async function conversaPorChat(chatIdExterno: string) {
	const { ConversaModel } = await import('../../src/models/conversa.model.js');
	const doc = await ConversaModel.findOne({ chatIdExterno }).lean();
	if (!doc) return null;
	return {
		canal: doc.canal as string,
		mensagens: (doc.mensagens ?? []).map((m) => ({
			papel: String(m.papel),
			conteudo: String(m.conteudo),
		})),
	};
}
