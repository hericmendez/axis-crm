import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';
import { getEnv } from '../config/env.js';

const PUBLIC_PATHS = new Set(['/health', '/api/v1/integrations/google/callback']);

export function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
	if (PUBLIC_PATHS.has(req.path)) {
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
