import { Schema, model } from 'mongoose';

export interface RefreshTokenDoc {
	id: string;
	userId: string;
	tokenHash: string;
	expiresAt: Date;
	revokedAt?: Date;
	replacedBy?: string;
	createdAt: Date;
}

const refreshTokenSchema = new Schema(
	{
		userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		tokenHash: { type: String, required: true, unique: true },
		expiresAt: { type: Date, required: true },
		revokedAt: { type: Date, default: null },
		replacedBy: { type: Schema.Types.ObjectId, ref: 'RefreshToken', default: null },
	},
	{ timestamps: { createdAt: true, updatedAt: false } },
);

// Stale sessions self-clean; live lookups always filter revokedAt/expiresAt explicitly.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function toRefreshTokenDTO(doc: Record<string, unknown>): RefreshTokenDoc {
	const raw = typeof doc.toObject === 'function' ? (doc.toObject() as Record<string, unknown>) : doc;
	const { _id, __v: _v, userId, ...rest } = raw as {
		_id: unknown;
		__v?: unknown;
		userId: unknown;
	};
	return {
		id: String(_id),
		userId: String(userId),
		...(rest as Omit<RefreshTokenDoc, 'id' | 'userId'>),
	};
}

export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
