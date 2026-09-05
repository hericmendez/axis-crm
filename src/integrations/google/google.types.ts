export interface GoogleServiceAccountConfig {
	clientEmail: string;
	privateKey: string;
}

export interface GoogleCalendarConfig extends GoogleServiceAccountConfig {
	calendarId: string;
}

export interface GoogleSheetsConfig extends GoogleServiceAccountConfig {
	spreadsheetId: string;
}

export function isGoogleConfigured(config: {
	GOOGLE_CLIENT_EMAIL?: string;
	GOOGLE_PRIVATE_KEY?: string;
}): boolean {
	return !!(config.GOOGLE_CLIENT_EMAIL && config.GOOGLE_PRIVATE_KEY);
}

export function normalizePrivateKey(raw: string): string {
	return raw.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
}
