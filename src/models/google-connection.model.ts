import { Schema, model } from 'mongoose';
import type { GoogleConnection } from '../types/google-connection.js';

const googleConnectionSchema = new Schema(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			unique: true,
		},
		googleSubject: { type: String, required: true },
		email: { type: String, required: true, lowercase: true, trim: true },
		refreshToken: { type: String, required: true },
		scopes: [{ type: String }],
	},
	{ timestamps: true },
);

googleConnectionSchema.index({ googleSubject: 1 });

export function toGoogleConnectionDTO(doc: { _id: unknown; __v?: unknown } & object): GoogleConnection {
	const { _id, __v: _v, ...rest } = doc;
	return {
		id: String(_id),
		...(rest as Omit<GoogleConnection, 'id'>),
	};
}

export const GoogleConnectionModel = model<GoogleConnection>('GoogleConnection', googleConnectionSchema);
