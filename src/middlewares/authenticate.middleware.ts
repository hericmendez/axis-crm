import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';
import { getEnv } from '../config/env.js';
import { UserModel } from '../models/user.model.js';
import { verifyAccessToken } from '../auth/tokens.js';
import { PUBLIC_PATHS } from './api-key.middleware.js';

export type AuthMethod = 'jwt' | 'api-key';

export type AuthenticatedRequest = Request & { userId?: string; authMethod?: AuthMethod };

function unauthorized(): AppError {
	return new AppError(401, 'Autenticação necessária');
}

// Human authentication (panel). Deterministic coexistence with the machine API key:
// - no Authorization header → no identity (machine path may still apply downstream)
// - invalid Bearer → 401, even when a valid x-api-key is also present
// - valid Bearer + x-api-key mapping to another/missing user → 401 (ambiguous identity)
// - valid Bearer + x-api-key for the same user → accepted as jwt
// Never creates users, never falls back silently.
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
	if (PUBLIC_PATHS.has(req.path)) {
		next();
		return;
	}

	const header = req.header('authorization');
	if (!header) {
		next();
		return;
	}

	const [scheme, token] = header.split(' ');
	// RFC 7235: auth-scheme is case-insensitive; anything else (or missing token) is not a Bearer credential
	if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
		next(unauthorized());
		return;
	}

	let userId: string;
	try {
		userId = verifyAccessToken(token).sub;
	} catch (err) {
		next(err);
		return;
	}

	// Defense in depth: our own signer only ever mints ObjectId subs.
	// A structurally valid token carrying any other identity is rejected here.
	if (!/^[0-9a-fA-F]{24}$/.test(userId)) {
		next(unauthorized());
		return;
	}

	const apiKey = req.header('x-api-key');
	if (apiKey) {
		const { API_KEY } = getEnv();
		if (!API_KEY || apiKey !== API_KEY) {
			next(unauthorized());
			return;
		}
		const keyUser = await UserModel.findOne({ apiKey }).select('_id').lean();
		if (!keyUser || String(keyUser._id) !== userId) {
			next(unauthorized());
			return;
		}
	}

	const authed = req as AuthenticatedRequest;
	authed.userId = userId;
	authed.authMethod = 'jwt';
	next();
}
