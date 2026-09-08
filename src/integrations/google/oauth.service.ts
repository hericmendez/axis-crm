import { google } from 'googleapis';
import crypto from 'node:crypto';
import { getEnv } from '../../config/env.js';
import { GoogleConnectionModel } from '../../models/google-connection.model.js';
import { OAuthStateModel } from '../../models/oauth-state.model.js';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const OAUTH_SCOPES = [
	'https://www.googleapis.com/auth/calendar.app.created',
	'https://www.googleapis.com/auth/spreadsheets',
	'https://www.googleapis.com/auth/drive.file',
	'https://www.googleapis.com/auth/userinfo.email',
	'https://www.googleapis.com/auth/userinfo.profile',
];

function getOAuth2Client() {
	const env = getEnv();
	if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET || !env.GOOGLE_OAUTH_REDIRECT_URI) {
		throw new Error('Google OAuth not configured: missing GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, or GOOGLE_OAUTH_REDIRECT_URI');
	}
	return new google.auth.OAuth2(
		env.GOOGLE_OAUTH_CLIENT_ID,
		env.GOOGLE_OAUTH_CLIENT_SECRET,
		env.GOOGLE_OAUTH_REDIRECT_URI,
	);
}

export async function generateAuthorizationUrl(userId: string): Promise<string> {
	const oauth2Client = getOAuth2Client();
	const state = crypto.randomBytes(32).toString('hex');

	await OAuthStateModel.create({
		state,
		userId,
	});

	const url = oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: OAUTH_SCOPES,
		state,
		prompt: 'consent',
	});

	logger.info({ userId }, 'Google OAuth authorization URL generated');
	return url;
}

export async function handleCallback(code: string, state: string): Promise<{ userId: string; email: string }> {
	const oauthState = await OAuthStateModel.findOneAndDelete({ state }).lean();
	if (!oauthState) {
		throw new AppError(400, 'Invalid or expired OAuth state');
	}

	const userId = String(oauthState.userId);
	const oauth2Client = getOAuth2Client();

	const { tokens } = await oauth2Client.getToken(code);
	oauth2Client.setCredentials(tokens);

	const userInfoRes = await oauth2Client.request({
		url: 'https://www.googleapis.com/oauth2/v2/userinfo',
		headers: { Authorization: `Bearer ${tokens.access_token}` },
	});
	const userInfo = userInfoRes.data as { id: string; email: string };

	if (!userInfo.id || !userInfo.email) {
		throw new AppError(500, 'Failed to retrieve Google user info');
	}

	const connectionData = {
		userId: oauthState.userId,
		googleSubject: userInfo.id,
		email: userInfo.email,
		refreshToken: tokens.refresh_token ?? '',
		scopes: OAUTH_SCOPES,
	};

	await GoogleConnectionModel.findOneAndUpdate(
		{ userId: oauthState.userId },
		connectionData,
		{ upsert: true, new: true },
	);

	logger.info({ userId, email: userInfo.email }, 'Google account connected');
	return { userId, email: userInfo.email };
}

export async function disconnectUser(userId: string): Promise<void> {
	const result = await GoogleConnectionModel.findOneAndDelete({ userId });
	if (result) {
		logger.info({ userId }, 'Google account disconnected');
	}
}

export async function getConnection(userId: string) {
	return GoogleConnectionModel.findOne({ userId }).lean();
}
