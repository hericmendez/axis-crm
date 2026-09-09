export interface User {
	id: string;
	name: string;
	apiKey?: string;
	email?: string;
	passwordHash?: string;
	createdAt: Date;
	updatedAt: Date;
}

export type CreateUserInput = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
