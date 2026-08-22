import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { complete } = await import('../../src/ai/providers/groq.provider.js');

const config = { apiKey: 'test-key', model: 'llama-3.3-70b-versatile' };

function groqReply(content: string) {
	return {
		ok: true,
		status: 200,
		json: async () => ({ choices: [{ message: { content } }] }),
	};
}

describe('groq.provider', () => {
	it('retorna ACTION validado', async () => {
		fetchMock.mockResolvedValue(
			groqReply(
				'{"mode":"ACTION","intent":"CRIAR_LEAD","confidence":0.95,"parameters":{"nome":"João"}}',
			),
		);
		const result = await complete(config, {
			messages: [{ role: 'user', content: 'criar lead João' }],
		});
		expect(result).toEqual({
			mode: 'ACTION',
			intent: 'CRIAR_LEAD',
			confidence: 0.95,
			parameters: { nome: 'João' },
		});
	});

	it('extrai JSON de resposta com markdown', async () => {
		fetchMock.mockResolvedValue(
			groqReply('```json\n{"mode":"CHAT","confidence":0.9,"response":"Olá!"}\n```'),
		);
		const result = await complete(config, { messages: [{ role: 'user', content: 'oi' }] });
		expect(result.mode).toBe('CHAT');
		if (result.mode === 'CHAT') expect(result.response).toBe('Olá!');
	});

	it('inclui system prompt na requisição', async () => {
		fetchMock.mockResolvedValue(
			groqReply('{"mode":"CHAT","confidence":1,"response":"ok"}'),
		);
		await complete(config, { messages: [{ role: 'user', content: 'teste' }] });
		const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
		expect(body.model).toBe('llama-3.3-70b-versatile');
		expect(body.messages[0].role).toBe('system');
	});

	it('rejeita intent desconhecida', async () => {
		fetchMock.mockResolvedValue(
			groqReply('{"mode":"ACTION","intent":"DELETAR_TUDO","confidence":1,"parameters":{}}'),
		);
		await expect(
			complete(config, { messages: [{ role: 'user', content: 'x' }] }),
		).rejects.toMatchObject({ statusCode: 502 });
	});

	it('erro HTTP do provedor vira 502 sem vazar corpo', async () => {
		fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
		await expect(
			complete(config, { messages: [{ role: 'user', content: 'x' }] }),
		).rejects.toMatchObject({ statusCode: 502 });
	});

	it('falha de rede vira 502', async () => {
		fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
		await expect(
			complete(config, { messages: [{ role: 'user', content: 'x' }] }),
		).rejects.toMatchObject({ statusCode: 502 });
	});
});
