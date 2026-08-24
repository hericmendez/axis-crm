import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { startTestMongo, stopTestMongo, clearCollections } from './setup.js';
import * as conversaService from '../../src/services/conversa.service.js';
import * as leadService from '../../src/services/lead.service.js';
import { AppError } from '../../src/utils/errors.js';

const WHATSAPP = 'whatsapp' as const;

async function criarConversaDeTeste(): Promise<string> {
	const conversa = await conversaService.getOrCreate(WHATSAPP, '120363411068401347@g.us');
	return conversa.id;
}

describe('ConversationService', () => {
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

	describe('getOrCreate', () => {
		it('cria uma nova conversa', async () => {
			const conversa = await conversaService.getOrCreate(WHATSAPP, 'chat-externo@g.us');
			expect(conversa.id).toBeTruthy();
			expect(conversa.canal).toBe('whatsapp');
			expect(conversa.chatIdExterno).toBe('chat-externo@g.us');
			expect(conversa.mensagens).toEqual([]);
			expect(conversa.leadId).toBeUndefined();
		});

		it('retorna a mesma conversa para o mesmo chat externo', async () => {
			const primeira = await conversaService.getOrCreate(WHATSAPP, 'chat-externo@g.us');
			const segunda = await conversaService.getOrCreate(WHATSAPP, 'chat-externo@g.us');
			expect(segunda.id).toBe(primeira.id);
		});

		it('conversas de chats diferentes são distintas', async () => {
			const a = await conversaService.getOrCreate(WHATSAPP, 'chat-a@g.us');
			const b = await conversaService.getOrCreate(WHATSAPP, 'chat-b@g.us');
			expect(a.id).not.toBe(b.id);
		});

		it('rejeita chatIdExterno vazio', async () => {
			await expect(conversaService.getOrCreate(WHATSAPP, '   ')).rejects.toMatchObject({
				statusCode: 400,
			});
		});
	});

	describe('get', () => {
		it('recupera conversa existente por id', async () => {
			const criada = await conversaService.getOrCreate(WHATSAPP, 'chat-x@g.us');
			const recuperada = await conversaService.get(criada.id);
			expect(recuperada.id).toBe(criada.id);
		});

		it('retorna 404 para id inexistente', async () => {
			await expect(conversaService.get('0'.repeat(24))).rejects.toBeInstanceOf(AppError);
		});
	});

	describe('appendMessage / getRecentMessages', () => {
		it('anexa mensagem de usuário', async () => {
			const id = await criarConversaDeTeste();
			const msg = await conversaService.appendMessage(id, {
				papel: 'usuario',
				conteudo: 'Olá, tudo bem?',
			});
			expect(msg.id).toBeTruthy();
			expect(msg.papel).toBe('usuario');
			expect(msg.conteudo).toBe('Olá, tudo bem?');
			expect(msg.criadoEm.getTime()).not.toBeNaN();
		});

		it('anexa mensagem do Axis', async () => {
			const id = await criarConversaDeTeste();
			const msg = await conversaService.appendMessage(id, {
				papel: 'axis',
				conteudo: 'Como posso ajudar?',
			});
			expect(msg.papel).toBe('axis');
		});

		it('rejeita conteúdo vazio', async () => {
			const id = await criarConversaDeTeste();
			await expect(
				conversaService.appendMessage(id, { papel: 'usuario', conteudo: '   ' }),
			).rejects.toMatchObject({ statusCode: 400 });
		});

		it('retorna 404 ao anexar em conversa inexistente', async () => {
			await expect(
				conversaService.appendMessage('0'.repeat(24), { papel: 'usuario', conteudo: 'oi' }),
			).rejects.toMatchObject({ statusCode: 404 });
		});

		it('retorna histórico em ordem cronológica', async () => {
			const id = await criarConversaDeTeste();
			await conversaService.appendMessage(id, { papel: 'usuario', conteudo: '1' });
			await conversaService.appendMessage(id, { papel: 'axis', conteudo: '2' });
			await conversaService.appendMessage(id, { papel: 'usuario', conteudo: '3' });

			const msgs = await conversaService.getRecentMessages(id, 10);
			expect(msgs.map((m) => m.conteudo)).toEqual(['1', '2', '3']);
			for (let i = 1; i < msgs.length; i++) {
				expect(msgs[i].criadoEm.getTime()).toBeGreaterThanOrEqual(msgs[i - 1].criadoEm.getTime());
			}
		});

		it('limita às N mensagens mais recentes mantendo ordem', async () => {
			const id = await criarConversaDeTeste();
			for (const texto of ['1', '2', '3', '4', '5']) {
				await conversaService.appendMessage(id, { papel: 'usuario', conteudo: texto });
			}
			const msgs = await conversaService.getRecentMessages(id, 3);
			expect(msgs.map((m) => m.conteudo)).toEqual(['3', '4', '5']);
		});

		it('aplica limites mínimo e máximo no limit', async () => {
			const id = await criarConversaDeTeste();
			await conversaService.appendMessage(id, { papel: 'usuario', conteudo: 'única' });
			expect((await conversaService.getRecentMessages(id, 0)).length).toBe(1);
			expect((await conversaService.getRecentMessages(id, 10000)).length).toBe(1);
		});
	});

	describe('associateLead', () => {
		it('associa um lead existente à conversa', async () => {
			const id = await criarConversaDeTeste();
			const lead = await leadService.create({
				nome: 'Maria',
				telefone: '11987654321',
				contatoOrigem: 'indicacao',
			});
			const conversa = await conversaService.associateLead(id, lead.id);
			expect(conversa.leadId).toBe(lead.id);
		});

		it('retorna 404 se o lead não existe', async () => {
			const id = await criarConversaDeTeste();
			await expect(conversaService.associateLead(id, '0'.repeat(24))).rejects.toMatchObject({
				statusCode: 404,
			});
		});

		it('retorna 404 se a conversa não existe', async () => {
			const lead = await leadService.create({
				nome: 'João',
				telefone: '11987654322',
				contatoOrigem: 'instagram',
			});
			await expect(conversaService.associateLead('0'.repeat(24), lead.id)).rejects.toMatchObject({
				statusCode: 404,
			});
		});
	});
});
