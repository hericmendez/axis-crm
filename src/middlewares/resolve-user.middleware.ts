import type { NextFunction, Request, Response } from 'express';
import { UserModel } from '../models/user.model.js';
import { logger } from '../utils/logger.js';

export async function resolveUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
	const apiKey = req.header('x-api-key');
	if (!apiKey) {
		next();
		return;
	}

	try {
		const user = await UserModel.findOne({ apiKey }).select('_id').lean();
		if (user) {
			(req as Request & { userId: string }).userId = String(user._id);
			next();
			return;
		}

		const created = await UserModel.create({ name: 'Axis User', apiKey });
		(req as Request & { userId: string }).userId = String(created._id);
		logger.info({ userId: (req as Request & { userId: string }).userId }, 'Default user created from API key');
		next();
	} catch (err) {
		logger.error({ err }, 'Failed to resolve user from API key');
		next();
	}
}
