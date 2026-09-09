import cors from 'cors';
import { getEnv } from '../config/env.js';

export function parseAllowedOrigins(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(',')
		.map((o) => o.trim().replace(/\/+$/, ''))
		.filter((o) => o.length > 0);
}

// Explicit allowlist CORS for the separate panel app. Never a wildcard:
// - requests without Origin (same-origin, curl, mobile, tests) pass through;
// - listed origins get a reflected Access-Control-Allow-Origin (+ Vary: Origin);
// - unlisted origins get no CORS headers (browser blocks reading the response).
// No credentials/cookies: the panel authenticates with bearer JWT.
export function buildCors() {
	const allowed = parseAllowedOrigins(getEnv().PANEL_ORIGIN);
	return cors({
		origin: (origin, callback) => {
			if (!origin) {
				callback(null, true);
				return;
			}
			callback(null, allowed.includes(origin));
		},
		credentials: false,
	});
}
