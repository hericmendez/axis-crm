import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
	PORT: z.coerce.number().int().positive().default(3000),
	MONGO_URI: z.string().min(1, 'MONGO_URI é obrigatório'),
	LOG_LEVEL: z.string().optional(),
	OLLAMA_BASE_URL: z.string().optional(),
	OLLAMA_MODEL: z.string().optional(),
	WHATSAPP_SESSION_PATH: z.string().optional(),
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional(),
	GOOGLE_REDIRECT_URI: z.string().optional(),
});

export type EnvSchema = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): EnvSchema {
	const parsed = envSchema.safeParse(source);
	if (!parsed.success) {
		const issues = parsed.error.issues
			.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
			.join('; ');
		throw new Error(`Configuração de ambiente inválida: ${issues}`);
	}
	return parsed.data;
}

let cached: EnvSchema | undefined;

export function getEnv(): EnvSchema {
	cached ??= loadEnv();
	return cached;
}
