import type { NextFunction, Request, Response } from 'express';
import * as leadService from '../services/lead.service.js';
import {
	createLeadSchema,
	listLeadsQuerySchema,
	updateLeadSchema,
} from '../validators/lead.validator.js';
import { AppError } from '../utils/errors.js';
import { normalizeTelefone } from '../utils/telefone.js';

type AuthRequest = Request & { userId?: string };

function requireUserId(req: Request): string {
	const userId = (req as AuthRequest).userId;
	if (!userId) {
		throw new AppError(401, 'Autenticação necessária');
	}
	return userId;
}

export async function create(req: Request, res: Response): Promise<void> {
	const userId = requireUserId(req);
	const parsed = createLeadSchema.safeParse(req.body);
	if (!parsed.success) {
		throw new AppError(400, parsed.error.issues.map((i) => i.message).join('; '));
	}
	const lead = await leadService.create(userId, parsed.data);
	res.status(201).json(lead);
}

export async function getById(req: Request, res: Response): Promise<void> {
	const userId = requireUserId(req);
	const lead = await leadService.getById(userId, String(req.params.id));
	res.json(lead);
}

export async function list(req: Request, res: Response): Promise<void> {
	const userId = requireUserId(req);
	const parsed = listLeadsQuerySchema.safeParse(req.query);
	if (!parsed.success) {
		throw new AppError(400, parsed.error.issues.map((i) => i.message).join('; '));
	}
	const { status, telefone, nome, page, limit } = parsed.data;
	let telefoneNormalizado: string | undefined;
	if (telefone) {
		try {
			telefoneNormalizado = normalizeTelefone(telefone);
		} catch {
			throw new AppError(400, 'Telefone inválido');
		}
	}
	const result = await leadService.list(
		userId,
		{
			...(status ? { status } : {}),
			...(telefoneNormalizado ? { telefone: telefoneNormalizado } : {}),
			...(nome ? { nome } : {}),
		},
		{ page, limit },
	);
	res.json(result);
}

export async function update(req: Request, res: Response): Promise<void> {
	const userId = requireUserId(req);
	const parsed = updateLeadSchema.safeParse(req.body);
	if (!parsed.success) {
		throw new AppError(400, parsed.error.issues.map((i) => i.message).join('; '));
	}
	const lead = await leadService.update(userId, String(req.params.id), parsed.data);
	res.json(lead);
}

export async function remove(req: Request, res: Response, _next: NextFunction): Promise<void> {
	const userId = requireUserId(req);
	await leadService.remove(userId, String(req.params.id));
	res.status(204).send();
}
