export interface Env {
	NODE_ENV: 'development' | 'test' | 'production';
	PORT: number;
	MONGO_URI: string;
	LOG_LEVEL?: string;
	OLLAMA_BASE_URL?: string;
	OLLAMA_MODEL?: string;
	WHATSAPP_SESSION_PATH?: string;
	GOOGLE_CLIENT_EMAIL?: string;
	GOOGLE_PRIVATE_KEY?: string;
	GOOGLE_CALENDAR_ID?: string;
	GOOGLE_SHEETS_SPREADSHEET_ID?: string;
	GOOGLE_OAUTH_CLIENT_ID?: string;
	GOOGLE_OAUTH_CLIENT_SECRET?: string;
	GOOGLE_OAUTH_REDIRECT_URI?: string;
}
