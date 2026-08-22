import type { NextFunction, Request, Response } from 'express';
import * as leadService from '../services/lead.service.js';
import {
	createLeadSchema,
	listLeadsQuerySchema,
	updateLeadSchema,
} from '../validators/lead.validator.js';
import { AppError } from '../utils/errors.js';

export async function create(req: Request, res: Response): Promise<void> {
	const parsed = createLeadSchema.safeParse(req.body);
	if (!parsed.success) {
		throw new AppError(400, parsed.error.issues.map((i) => i.message).join('; '));
	}
	const lead = await leadService.create(parsed.data);
	res.status(201).json(lead);
}

export async function getById(req: Request, res: Response): Promise<void> {
	const lead = await leadService.getById(String(req.params.id));
	res.json(lead);
}

export async function list(req: Request, res: Response): Promise<void> {
	const parsed = listLeadsQuerySchema.safeParse(req.query);
	if (!parsed.success) {
		throw new AppError(400, parsed.error.issues.map((i) => i.message).join('; '));
	}
	const { status, page, limit } = parsed.data;
	const result = await leadService.list(status ? { status } : {}, { page, limit });
	res.json(result);
}

export async function update(req: Request, res: Response): Promise<void> {
	const parsed = updateLeadSchema.safeParse(req.body);
	if (!parsed.success) {
		throw new AppError(400, parsed.error.issues.map((i) => i.message).join('; '));
	}
	const lead = await leadService.update(String(req.params.id), parsed.data);
	res.json(lead);
}

export async function remove(req: Request, res: Response, _next: NextFunction): Promise<void> {
	await leadService.remove(String(req.params.id));
	res.status(204).send();
}
