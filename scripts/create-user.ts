// Bootstrap script: creates the first human panel user.
// Usage: pnpm auth:create-user --email admin@example.com --password '...' [--name Admin]
// No default credentials: email and password must be provided explicitly.
import { getEnv } from '../src/config/env.js';
import { connectMongo, disconnectMongo } from '../src/infra/mongo/mongo.connection.js';
import { createUserSchema } from '../src/validators/auth.validator.js';
import { createUserWithPassword } from '../src/services/auth.service.js';

function argValue(flag: string): string | undefined {
	const index = process.argv.indexOf(flag);
	return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
	const env = getEnv();
	const parsed = createUserSchema.safeParse({
		name: argValue('--name') ?? 'Axis Admin',
		email: argValue('--email'),
		password: argValue('--password'),
	});
	if (!parsed.success) {
		console.error(`Uso: pnpm auth:create-user --email <email> --password <senha> [--name <nome>]`);
		console.error(parsed.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n'));
		process.exitCode = 1;
		return;
	}
	await connectMongo(env.MONGO_URI);
	try {
		const user = await createUserWithPassword(parsed.data);
		console.log(`Usuário criado: id=${user.id} email=${user.email}`);
	} finally {
		await disconnectMongo();
	}
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exitCode = 1;
});
