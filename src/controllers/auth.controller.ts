import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { loginSchema, refreshSchema } from '../validators/auth.validator.js';
import { AppError } from '../utils/errors.js';

export async function login(req: Request, res: Response): Promise<void> {
	const parsed = loginSchema.safeParse(req.body);
	if (!parsed.success) {
		throw new AppError(400, 'Credenciais inválidas');
	}
	const result = await authService.login(parsed.data.email, parsed.data.password);
	res.json({
		accessToken: result.accessToken,
		refreshToken: result.refreshToken,
		user: result.user,
	});
}

export async function refresh(req: Request, res: Response): Promise<void> {
	const parsed = refreshSchema.safeParse(req.body);
	if (!parsed.success) {
		throw new AppError(400, 'Requisição inválida');
	}
	const result = await authService.refresh(parsed.data.refreshToken);
	res.json({
		accessToken: result.accessToken,
		refreshToken: result.refreshToken,
		user: result.user,
	});
}

export async function logout(req: Request, res: Response): Promise<void> {
	const parsed = refreshSchema.safeParse(req.body);
	if (parsed.success) {
		await authService.logout(parsed.data.refreshToken);
	}
	res.json({ ok: true });
}
