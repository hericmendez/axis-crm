import type { Request, Response } from 'express';
import * as conversaService from '../services/conversa.service.js';
import {
	conversaDetailQuerySchema,
	conversaIdParamSchema,
	listConversasQuerySchema,
} from '../validators/conversa.validator.js';
import { AppError } from '../utils/errors.js';

type AuthRequest = Request & { userId?: string };

function requireUserId(req: Request): string {
	const userId = (req as AuthRequest).userId;
	if (!userId) {
		throw new AppError(401, 'Autenticação necessária');
	}
	return userId;
}

function parseOr400<T>(result: { success: boolean; data?: T; error?: { issues: { message: string }[] } }): T {
	if (!result.success) {
		throw new AppError(400, result.error!.issues.map((i) => i.message).join('; '));
	}
	return result.data!;
}

export async function list(req: Request, res: Response): Promise<void> {
	const userId = requireUserId(req);
	const parsed = parseOr400(listConversasQuerySchema.safeParse(req.query));
	const { leadId, canal, chatIdExterno, page, limit } = parsed;
	const result = await conversaService.list(
		userId,
		{
			...(leadId ? { leadId } : {}),
			...(canal ? { canal } : {}),
			...(chatIdExterno ? { chatIdExterno } : {}),
		},
		{ page, limit },
	);
	res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
	const userId = requireUserId(req);
	const { id } = parseOr400(conversaIdParamSchema.safeParse(req.params));
	const parsed = parseOr400(conversaDetailQuerySchema.safeParse(req.query));
	const conversa = await conversaService.getDetail(userId, id, parsed.limit);
	res.json(conversa);
}
