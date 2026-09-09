// Tenancy backfill (Phase 6.3): assigns ownerless Lead/Evento/Conversa documents
// to the explicit operator user, drops legacy single-tenant indexes, and verifies.
// Usage: pnpm tenancy:backfill --user-id <User _id>   (or AXIS_USER_ID env)
// Never invents a user: the operator must exist, otherwise the script fails.
import { getEnv } from '../src/config/env.js';
import { connectMongo, disconnectMongo } from '../src/infra/mongo/mongo.connection.js';
import {
	backfillTenancy,
	countMissingTenancy,
	dropLegacyIndexes,
} from '../src/migrations/backfill-tenancy.js';

function argValue(flag: string): string | undefined {
	const index = process.argv.indexOf(flag);
	return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
	const env = getEnv();
	const operatorUserId = argValue('--user-id') ?? env.AXIS_USER_ID;
	if (!operatorUserId) {
		console.error('Uso: pnpm tenancy:backfill --user-id <User _id> (ou AXIS_USER_ID no .env)');
		process.exitCode = 1;
		return;
	}
	await connectMongo(env.MONGO_URI);
	try {
		const result = await backfillTenancy(operatorUserId);
		console.log(`Backfill: leads=${result.leads} eventos=${result.eventos} conversas=${result.conversas}`);
		const dropped = await dropLegacyIndexes();
		for (const name of dropped) console.log(`Índice legado removido: ${name}`);
		const missing = await countMissingTenancy();
		console.log(`Sem owner: leads=${missing.leads} eventos=${missing.eventos} conversas=${missing.conversas}`);
		if (missing.leads + missing.eventos + missing.conversas > 0) {
			console.error('FALHA: ainda existem documentos sem userId');
			process.exitCode = 1;
		}
	} finally {
		await disconnectMongo();
	}
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exitCode = 1;
});
