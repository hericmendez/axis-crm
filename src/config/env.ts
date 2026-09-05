import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
		PORT: z.coerce.number().int().positive().default(3000),
		MONGO_URI: z.string().min(1, 'MONGO_URI é obrigatório'),
		LOG_LEVEL: z.string().optional(),
		API_KEY: z.string().min(1).optional(),
		LLM_PROVIDER: z.enum(['ollama', 'groq']).default('groq'),
		GROQ_API_KEY: z.string().min(1).optional(),
		GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
		OLLAMA_BASE_URL: z.string().optional(),
		OLLAMA_MODEL: z.string().optional(),
		WHATSAPP_SESSION_PATH: z.string().optional(),
		WHATSAPP_ENABLED: z.coerce.boolean().default(false),
		WHATSAPP_ALLOWED_GROUPS: z.string().optional(),
		AXIS_NUMBER: z.string().optional(),
		WHATSAPP_SELF_LID: z.string().optional(),
		// Google Service Account
		GOOGLE_CLIENT_EMAIL: z.string().optional(),
		GOOGLE_PRIVATE_KEY: z.string().optional(),
		GOOGLE_CALENDAR_ID: z.string().optional(),
		GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional(),
		// Google OAuth 2.0
		GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
		GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
		GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),
	})
	.refine(
		(data) => {
			const hasGoogle = !!(data.GOOGLE_CLIENT_EMAIL || data.GOOGLE_PRIVATE_KEY || data.GOOGLE_CALENDAR_ID || data.GOOGLE_SHEETS_SPREADSHEET_ID);
			if (!hasGoogle) return true;
			return !!(data.GOOGLE_CLIENT_EMAIL && data.GOOGLE_PRIVATE_KEY);
		},
		{
			message:
				'Google integrations require both GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY when any Google config is provided',
			path: ['GOOGLE_CLIENT_EMAIL'],
		},
	);

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
