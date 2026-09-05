import type { Request, Response } from 'express';
import * as oauthService from '../integrations/google/oauth.service.js';
import { AppError } from '../utils/errors.js';

type AuthRequest = Request & { userId: string };

export function connect(req: Request, res: Response): void {
	const userId = (req as AuthRequest).userId;
	if (!userId) {
		throw new AppError(401, 'Authentication required');
	}

	const url = oauthService.generateAuthorizationUrl(userId);
	res.json({ url });
}

export async function callback(req: Request, res: Response): Promise<void> {
	const { code, state, error } = req.query;

	if (error === 'access_denied') {
		res.status(403).json({ error: 'Access denied by user' });
		return;
	}

	if (typeof code !== 'string' || typeof state !== 'string') {
		throw new AppError(400, 'Missing code or state parameter');
	}

	const result = await oauthService.handleCallback(code, state);
	res.json({ connected: true, email: result.email });
}

export async function disconnect(req: Request, res: Response): Promise<void> {
	const userId = (req as AuthRequest).userId;
	if (!userId) {
		throw new AppError(401, 'Authentication required');
	}

	await oauthService.disconnectUser(userId);
	res.status(204).send();
}

export async function status(req: Request, res: Response): Promise<void> {
	const userId = (req as AuthRequest).userId;
	if (!userId) {
		throw new AppError(401, 'Authentication required');
	}

	const connection = await oauthService.getConnection(userId);
	if (!connection) {
		res.json({ connected: false });
		return;
	}

	res.json({
		connected: true,
		email: connection.email,
		createdAt: connection.createdAt,
	});
}
