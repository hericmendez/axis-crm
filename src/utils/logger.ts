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
				'refreshToken',
				'*.password',
				'*.token',
				'*.refreshToken',
			],
			censor: '[redacted]',
		},
	});
}

export const logger = createLogger();
