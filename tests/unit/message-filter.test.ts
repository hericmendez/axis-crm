import { describe, expect, it } from 'vitest';
import { shouldProcessMessage } from '../../src/whatsapp/message-filter.js';
import type { IncomingMessageInfo } from '../../src/whatsapp/message-filter.js';

const config = {
	selfIds: ['5511999999999'],
	allowedGroups: ['grupo-autorizado@g.us'],
};

function msg(partial: Partial<IncomingMessageInfo>): IncomingMessageInfo {
	return {
		fromMe: false,
		isGroup: true,
		chatId: 'grupo-autorizado@g.us',
		body: 'olá',
		hasMention: false,
		mentionedNumbers: [],
		...partial,
	};
}

describe('shouldProcessMessage', () => {
	it('ignora mensagem própria (proteção contra loop)', () => {
		const r = shouldProcessMessage(msg({ fromMe: true }), config);
		expect(r.process).toBe(false);
	});

	it('ignora status@broadcast', () => {
		const r = shouldProcessMessage(
			msg({ isGroup: false, chatId: 'status@broadcast', body: '' }),
			config,
		);
		expect(r.process).toBe(false);
	});

	it('ignora newsletters e broadcasts', () => {
		for (const chatId of ['123@newsletter', '456@broadcast']) {
			const r = shouldProcessMessage(msg({ isGroup: false, chatId }), config);
			expect(r.process).toBe(false);
		}
	});

	it('ignora grupo não autorizado', () => {
		const r = shouldProcessMessage(msg({ chatId: 'outro@g.us' }), config);
		expect(r.process).toBe(false);
		expect(r.reason).toBe('grupo não autorizado');
	});

	it('ignora mensagem de grupo sem menção', () => {
		const r = shouldProcessMessage(msg({}), config);
		expect(r.process).toBe(false);
	});

	it('processa quando o número do Axis é mencionado', () => {
		const r = shouldProcessMessage(
			msg({ mentionedNumbers: ['5511999999999@c.us'], body: '' }),
			config,
		);
		expect(r.process).toBe(true);
	});

	it('processa quando o LID do Axis é mencionado', () => {
		const r = shouldProcessMessage(
			msg({ mentionedNumbers: ['257256360804483@lid'], body: 'texto qualquer' }),
			{ selfIds: ['257256360804483@lid'], allowedGroups: config.allowedGroups },
		);
		expect(r.process).toBe(true);
	});
	it('processa menção por número mesmo com máscara', () => {
		const r = shouldProcessMessage(
			msg({ hasMention: true, mentionedNumbers: ['55 11 99999-9999'] }),
			config,
		);
		expect(r.process).toBe(true);
	});

	it('processa quando o texto contém @axis', () => {
		const r = shouldProcessMessage(msg({ body: '@Axis quanto leads hoje?' }), config);
		expect(r.process).toBe(true);
	});

	it('@axis dentro de outra palavra não conta como menção textual', () => {
		const r = shouldProcessMessage(msg({ body: 'email eixo@axiss.com' }), config);
		expect(r.process).toBe(false);
	});

	it('mensagem privada é processada sem exigir menção', () => {
		const r = shouldProcessMessage(
			msg({ isGroup: false, chatId: '5511888888888@c.us' }),
			config,
		);
		expect(r.process).toBe(true);
	});
});
