import type { Request, Response } from 'express';
import { getStatus } from '../whatsapp/whatsapp.service.js';
import { AppError } from '../utils/errors.js';

type AuthRequest = Request & { userId?: string };

function requireUserId(req: Request): string {
	const userId = (req as AuthRequest).userId;
	if (!userId) {
		throw new AppError(401, 'Autenticação necessária');
	}
	return userId;
}

// Safe read-only view of the single-channel WhatsApp integration.
// Exposes only status + QR payload; never session files, tokens or client internals.
export async function status(req: Request, res: Response): Promise<void> {
	requireUserId(req);
	const { status } = getStatus();
	res.json({ status, connected: status === 'conectado' });
}

export async function qr(req: Request, res: Response): Promise<void> {
	requireUserId(req);
	const { qr } = getStatus();
	if (!qr) {
		throw new AppError(404, 'QR Code indisponível');
	}
	res.json({ qr });
}
