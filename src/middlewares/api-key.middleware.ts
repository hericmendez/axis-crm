import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';
import { getEnv } from '../config/env.js';

// Public by necessity, never by convenience:
// - /health: liveness probe (no data)
// - OAuth callback: Google redirects the browser here without credentials;
//   the single-use `state` (OAuthState, findOneAndDelete) is the authorization
// - /api/auth/*: login/refresh/logout cannot require prior authentication;
//   brute force is contained by the auth rate limiter instead
export const PUBLIC_PATHS = new Set([
	'/health',
	'/api/v1/integrations/google/callback',
	'/api/auth/login',
	'/api/auth/refresh',
	'/api/auth/logout',
]);

export function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
	if (PUBLIC_PATHS.has(req.path)) {
		next();
		return;
	}

	// Human JWT identity already established takes precedence; the machine key
	// is only evaluated when no Bearer identity exists (see authenticate).
	if ((req as Request & { authMethod?: string }).authMethod === 'jwt') {
		next();
		return;
	}

	const { API_KEY } = getEnv();
	if (!API_KEY) {
		next();
		return;
	}

	const provided = req.header('x-api-key');
	if (provided !== API_KEY) {
		next(new AppError(401, 'API key inválida ou ausente'));
		return;
	}
	next();
}
