// E2E backend launcher (Phase 6.10 only, never production).
// Boots the real API against an isolated in-memory MongoDB and seeds the
// deterministic users (plus one conversation) that the Playwright journeys
// need. Everything else is created through the UI/API by the tests.
//
// NOTE: backend modules read env at import time (logger/getEnv), so the
// memory server starts and MONGO_URI is set BEFORE any backend import below
// (all backend imports are dynamic for this reason).
async function main(): Promise<void> {
	const { MongoMemoryServer } = await import('mongodb-memory-server');
	const mongo = await MongoMemoryServer.create();
	process.env.MONGO_URI = mongo.getUri('axis-e2e');

	const mongoose = (await import('mongoose')).default;
	await mongoose.connect(process.env.MONGO_URI);

	const { createUserWithPassword } = await import('../src/services/auth.service.js');
	const conversaService = await import('../src/services/conversa.service.js');

	const userA = await createUserWithPassword({
		name: 'E2E A',
		email: 'e2e-a@example.com',
		password: 'senha-forte-123',
	});
	await createUserWithPassword({
		name: 'E2E B',
		email: 'e2e-b@example.com',
		password: 'senha-forte-123',
	});

	const conversa = await conversaService.getOrCreate(userA.id, 'whatsapp', '5511999999999@c.us');
	await conversaService.appendMessage(userA.id, conversa.id, {
		papel: 'usuario',
		conteudo: 'Olá, quero agendar',
	});
	await conversaService.appendMessage(userA.id, conversa.id, {
		papel: 'axis',
		conteudo: 'Claro, qual dia?',
	});

	// The server boots (listen) on import via main().
	await import('../src/server.js');
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exitCode = 1;
});
