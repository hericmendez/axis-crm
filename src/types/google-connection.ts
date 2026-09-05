export interface GoogleConnection {
	id: string;
	userId: string;
	googleSubject: string;
	email: string;
	refreshToken: string;
	scopes: string[];
	createdAt: Date;
	updatedAt: Date;
}

export type CreateGoogleConnectionInput = Omit<GoogleConnection, 'id' | 'createdAt' | 'updatedAt'>;
