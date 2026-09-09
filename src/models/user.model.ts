import { Schema, model } from 'mongoose';
import type { User } from '../types/user.js';

const userSchema = new Schema(
	{
		name: { type: String, required: true, trim: true },
		apiKey: { type: String, sparse: true, unique: true },
		email: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
		passwordHash: { type: String, select: false },
	},
	{ timestamps: true },
);

export function toUserDTO(doc: { _id: unknown; __v?: unknown } & object): User {
	const { _id, __v: _v, passwordHash: _ph, ...rest } = doc as {
		_id: unknown;
		__v?: unknown;
		passwordHash?: unknown;
	} & object;
	return {
		id: String(_id),
		...(rest as Omit<User, 'id'>),
	};
}

export const UserModel = model<User>('User', userSchema);
