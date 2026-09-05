import { Schema, model } from 'mongoose';
import type { User } from '../types/user.js';

const userSchema = new Schema(
	{
		name: { type: String, required: true, trim: true },
		apiKey: { type: String, sparse: true, unique: true },
	},
	{ timestamps: true },
);

export function toUserDTO(doc: { _id: unknown; __v?: unknown } & object): User {
	const { _id, __v: _v, ...rest } = doc;
	return {
		id: String(_id),
		...(rest as Omit<User, 'id'>),
	};
}

export const UserModel = model<User>('User', userSchema);
