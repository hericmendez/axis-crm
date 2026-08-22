export interface Env {
	NODE_ENV: 'development' | 'test' | 'production';
	PORT: number;
	MONGO_URI: string;
	LOG_LEVEL?: string;
	OLLAMA_BASE_URL?: string;
	OLLAMA_MODEL?: string;
	WHATSAPP_SESSION_PATH?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	GOOGLE_REDIRECT_URI?: string;
}
