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
		vi.useFakeTimers();
		try {
			const client = mockClient();
			connect(client);

			await whatsappService.sendMessage('chat@g.us', 'primeira');
			await expect(whatsappService.sendMessage('chat@g.us', 'segunda')).rejects.toMatchObject({
				statusCode: 429,
			});

			vi.setSystemTime(Date.now() + 3_001);
			await expect(
				whatsappService.sendMessage('chat@g.us', 'terceira'),
			).resolves.toBeUndefined();
			expect(client.sendText).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it('dois envios concorrentes: apenas um alcança o client, o outro recebe 429', async () => {
		let resolveSend: () => void = () => {};
		const client = mockClient({
			sendText: vi.fn().mockImplementation(
				() =>
					new Promise<void>((resolve) => {
						resolveSend = resolve;
					}),
			),
		});
		connect(client);

		const first = whatsappService.sendMessage('chat@g.us', 'a');
		const second = whatsappService.sendMessage('chat@g.us', 'b');
		resolveSend();
		const results = await Promise.allSettled([first, second]);

		expect(results[0].status).toBe('fulfilled');
		expect(results[1].status).toBe('rejected');
		const rejection = (results[1] as PromiseRejectedResult).reason;
		expect(rejection).toMatchObject({ statusCode: 429 });
		expect(client.sendText).toHaveBeenCalledTimes(1);
		resolveSend();
	});

	it('após falha do provider, a reserva é liberada e novo envio imediato funciona', async () => {
		const client = mockClient({
			sendText: vi
				.fn()
				.mockRejectedValueOnce(new Error('falha'))
				.mockResolvedValueOnce(undefined),
		});
		connect(client);

		const firstErr = await whatsappService.sendMessage('chat@g.us', 'a').then(
			() => null,
			(e) => e,
		);
		expect(firstErr).toMatchObject({ statusCode: 502 });

		await expect(whatsappService.sendMessage('chat@g.us', 'b')).resolves.toBeUndefined();
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
