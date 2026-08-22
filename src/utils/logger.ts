import pino from 'pino';
import { getEnv } from '../config/env.js';

export function createLogger() {
	const env = getEnv();
	return pino({
		level: env.LOG_LEVEL ?? 'info',
		redact: {
			paths: [
				'req.headers.authorization',
				'req.headers["x-api-key"]',
				'password',
				'token',
				'*.password',
				'*.token',
			],
			censor: '[redacted]',
		},
	});
}

export const logger = createLogger();
