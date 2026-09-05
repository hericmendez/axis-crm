export interface GoogleConnection {
	id: string;
	userId: string;
	googleSubject: string;
	email: string;
	refreshToken: string;
	scopes: string[];
	calendarId?: string;
	spreadsheetId?: string;
	createdAt: Date;
	updatedAt: Date;
}

export type CreateGoogleConnectionInput = Omit<GoogleConnection, 'id' | 'createdAt' | 'updatedAt'>;
