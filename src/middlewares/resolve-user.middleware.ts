import type { NextFunction, Request, Response } from 'express';
import { UserModel } from '../models/user.model.js';
import { logger } from '../utils/logger.js';

export async function resolveUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
	// Identity already established by human JWT authentication: never override,
	// never auto-create. Machine API-key path below is preserved for compatibility.
	const typed = req as Request & { userId?: string; authMethod?: string };
	if (typed.userId) {
		next();
		return;
	}

	const apiKey = req.header('x-api-key');
	if (!apiKey) {
		next();
		return;
	}

	try {
		const user = await UserModel.findOne({ apiKey }).select('_id').lean();
		if (user) {
			typed.userId = String(user._id);
			typed.authMethod = 'api-key';
			next();
			return;
		}

		const created = await UserModel.create({ name: 'Axis User', apiKey });
		typed.userId = String(created._id);
		typed.authMethod = 'api-key';
		logger.info({ userId: typed.userId }, 'Default user created from API key');
		next();
	} catch (err) {
		logger.error({ err }, 'Failed to resolve user from API key');
		next();
	}
}
