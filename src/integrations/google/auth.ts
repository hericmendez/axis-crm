import { google, type Auth } from 'googleapis';
import type { GoogleServiceAccountConfig } from './google.types.js';
import { normalizePrivateKey } from './google.types.js';
import { logger } from '../../utils/logger.js';

export interface GoogleAuthProvider {
	getClient(): Promise<Auth.JWT | Auth.OAuth2Client>;
}

let cachedClient: Auth.JWT | null = null;

function createServiceAccountClient(config: GoogleServiceAccountConfig): Auth.JWT {
	if (cachedClient) return cachedClient;

	const normalizedKey = normalizePrivateKey(config.privateKey);

	const auth = new google.auth.GoogleAuth({
		credentials: {
			client_email: config.clientEmail,
			private_key: normalizedKey,
		},
		scopes: [
			'https://www.googleapis.com/auth/calendar',
			'https://www.googleapis.com/auth/spreadsheets',
		],
	});

	const client = auth.fromJSON({
		client_email: config.clientEmail,
		private_key: normalizedKey,
	}) as Auth.JWT;

	cachedClient = client;

	logger.info({ clientEmail: config.clientEmail }, 'Google Service Account auth initialized');

	return client;
}

export function createServiceAccountProvider(config: GoogleServiceAccountConfig): GoogleAuthProvider {
	return {
		async getClient() {
			return createServiceAccountClient(config);
		},
	};
}

export function getGoogleAuth(config: GoogleServiceAccountConfig): Auth.JWT {
	return createServiceAccountClient(config);
}

export function clearAuthCache(): void {
	cachedClient = null;
}
