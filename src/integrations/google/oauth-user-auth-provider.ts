import { google, type Auth } from 'googleapis';
import { GoogleConnectionModel } from '../../models/google-connection.model.js';
import { getEnv } from '../../config/env.js';
import type { GoogleAuthProvider } from './auth.js';
import { logger } from '../../utils/logger.js';

export function createOAuthUserProvider(userId: string): GoogleAuthProvider {
	return {
		async getClient(): Promise<Auth.OAuth2Client> {
			const connection = await GoogleConnectionModel.findOne({ userId }).lean();
			if (!connection) {
				throw new Error(`No Google connection found for user ${userId}`);
			}

			const env = getEnv();
			if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET || !env.GOOGLE_OAUTH_REDIRECT_URI) {
				throw new Error('Google OAuth not configured');
			}

			const oauth2Client = new google.auth.OAuth2(
				env.GOOGLE_OAUTH_CLIENT_ID,
				env.GOOGLE_OAUTH_CLIENT_SECRET,
				env.GOOGLE_OAUTH_REDIRECT_URI,
			);

			oauth2Client.setCredentials({
				refresh_token: connection.refreshToken,
			});

			logger.debug({ userId, email: connection.email }, 'OAuth user auth provider created');
			return oauth2Client;
		},
	};
}
