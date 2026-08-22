import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { WhatsAppClient } from '../../src/types/whatsapp.js';

const whatsappService = await import('../../src/whatsapp/whatsapp.service.js');
const sendRateLimiter = await import('../../src/whatsapp/send-rate-limiter.js');

function mockClient(overrides: Partial<WhatsAppClient> = {}): WhatsAppClient {
	return {
		sendText: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

function connect(client: WhatsAppClient): void {
	whatsappService.setStatus('conectado');
	whatsappService.setClient(client);
}

beforeEach(() => {
	vi.restoreAllMocks();
	whatsappService.clearClient();
	whatsappService.setStatus('desconectado');
	whatsappService.setQr(undefined);
	sendRateLimiter.resetRateLimit();
});

describe('whatsapp.service sendMessage', () => {
	it('envia mensagem através do client registrado', async () => {
		const client = mockClient();
		connect(client);

		await whatsappService.sendMessage('chat@g.us', 'olá');

		expect(client.sendText).toHaveBeenCalledWith('chat@g.us', 'olá');
	});

	it('rejeita com 503 quando não há client registrado', async () => {
		whatsappService.setStatus('conectado');
		await expect(whatsappService.sendMessage('chat@g.us', 'oi')).rejects.toMatchObject({
			statusCode: 503,
		});
	});

	it('rejeita com 503 quando WhatsApp está desconectado', async () => {
		const client = mockClient();
		connect(client);
		whatsappService.setStatus('desconectado');

		await expect(whatsappService.sendMessage('chat@g.us', 'oi')).rejects.toMatchObject({
			statusCode: 503,
		});
		expect(client.sendText).not.toHaveBeenCalled();
	});

	it('converte falha do client em 502 sem vazar o erro interno', async () => {
		const client = mockClient({
			sendText: vi.fn().mockRejectedValue(new Error('Evaluation failed: X-Internal-Secret')),
		});
		connect(client);

		const err = await whatsappService.sendMessage('chat@g.us', 'oi').then(
			() => null,
			(e) => e as Error,
		);
		expect(err).toMatchObject({ statusCode: 502 });
		expect((err as Error).message).not.toContain('Internal-Secret');
	});

	it('rate limit bloqueia segundo envio imediato e libera após intervalo', async () => {
		const client = mockClient();
		connect(client);

		await whatsappService.sendMessage('chat@g.us', 'primeira');
		await expect(whatsappService.sendMessage('chat@g.us', 'segunda')).rejects.toMatchObject({
			statusCode: 429,
		});

		sendRateLimiter.markSent(Date.now() - 10_000);
		await expect(
			whatsappService.sendMessage('chat@g.us', 'terceira'),
		).resolves.toBeUndefined();
		expect(client.sendText).toHaveBeenCalledTimes(2);
	});

	it('após clearClient, novo envio falha com 503', async () => {
		const client = mockClient();
		connect(client);
		whatsappService.clearClient();

		await expect(whatsappService.sendMessage('chat@g.us', 'oi')).rejects.toMatchObject({
			statusCode: 503,
		});
	});

	it('rejeita chatId ou texto vazios', async () => {
		const client = mockClient();
		connect(client);

		await expect(whatsappService.sendMessage('', 'oi')).rejects.toMatchObject({
			statusCode: 400,
		});
		await expect(whatsappService.sendMessage('chat@g.us', '   ')).rejects.toMatchObject({
			statusCode: 400,
		});
		expect(client.sendText).not.toHaveBeenCalled();
	});
});
