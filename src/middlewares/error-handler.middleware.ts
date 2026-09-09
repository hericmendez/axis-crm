import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function errorHandler(
	err: unknown,
	req: Request,
	res: Response,
	_next: NextFunction,
): void {
	if (err instanceof AppError) {
		logger.warn({ err, path: req.originalUrl }, 'Erro de aplicação');
		res.status(err.statusCode).json({ error: err.message });
		return;
	}

	// Malformed JSON bodies must not surface as 500s nor leak parser internals
	if (
		typeof err === 'object' &&
		err !== null &&
		(err as { type?: unknown }).type === 'entity.parse.failed'
	) {
		logger.warn({ path: req.originalUrl }, 'Corpo JSON inválido');
		res.status(400).json({ error: 'Corpo da requisição inválido' });
		return;
	}

	logger.error({ err, path: req.originalUrl }, 'Erro não tratado');
	res.status(500).json({ error: 'Internal Server Error' });
}
