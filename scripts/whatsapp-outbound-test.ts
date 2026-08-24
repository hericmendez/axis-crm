// Teste de integração one-shot do envio outbound (Fase 2).
// Usa apenas a fronteira da aplicação (whatsapp.service.sendMessage);
// whatsapp-web.js permanece isolado no adapter.
// Uso: pnpm tsx --env-file=.env scripts/whatsapp-outbound-test.ts <chatId>
import * as whatsappAdapter from '../src/whatsapp/whatsapp.adapter.js';
import * as whatsappService from '../src/whatsapp/whatsapp.service.js';
import { logger } from '../src/utils/logger.js';

const chatId = process.argv[2];
if (!chatId) {
	console.error('Uso: tsx --env-file=.env scripts/whatsapp-outbound-test.ts <chatId>');
	process.exit(1);
}

const timeout = setTimeout(() => {
	logger.error('Timeout aguardando conexão do WhatsApp');
	process.exit(1);
}, 120_000);

try {
	await whatsappAdapter.start();
	let attempts = 0;
	while (whatsappService.getStatus().status !== 'conectado' && attempts < 120) {
		await new Promise((r) => setTimeout(r, 1000));
		attempts++;
	}
	if (whatsappService.getStatus().status !== 'conectado') {
		throw new Error('WhatsApp não conectou a tempo');
	}

	await whatsappService.sendMessage(chatId, 'AXIS outbound integration test');
	logger.info({ chatId }, 'Teste outbound concluído com sucesso');
	clearTimeout(timeout);
} catch (err) {
	logger.error({ err }, 'Falha no teste outbound');
	process.exitCode = 1;
} finally {
	clearTimeout(timeout);
	await whatsappAdapter.stop().catch(() => undefined);
}
