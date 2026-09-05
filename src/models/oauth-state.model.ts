import { Schema, model } from 'mongoose';
import type { OAuthState } from '../types/google-oauth.js';

const OAUTH_STATE_TTL_MINUTES = 10;

const oauthStateSchema = new Schema({
	state: { type: String, required: true, unique: true, index: true },
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
	expiresAt: {
		type: Date,
		required: true,
		default: () => new Date(Date.now() + OAUTH_STATE_TTL_MINUTES * 60 * 1000),
		index: { expireAfterSeconds: 0 },
	},
}, { timestamps: true });

export const OAuthStateModel = model<OAuthState>('OAuthState', oauthStateSchema);
