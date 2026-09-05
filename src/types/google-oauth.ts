import type { Types } from 'mongoose';

export interface OAuthState {
	_id?: Types.ObjectId;
	state: string;
	userId: string;
	expiresAt: Date;
	createdAt: Date;
}
