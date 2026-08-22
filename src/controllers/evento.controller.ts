import type { Request, Response } from 'express';
import * as eventoService from '../services/evento.service.js';
import * as metricasService from '../services/metricas.service.js';
import {
	createEventoSchema,
	leadIdParamSchema,
	periodoQuerySchema,
} from '../validators/evento.validator.js';
import { AppError } from '../utils/errors.js';

function parseOr400<T>(result: { success: boolean; data?: T; error?: { issues: { message: string }[] } }): T {
	if (!result.success) {
		throw new AppError(400, result.error!.issues.map((i) => i.message).join('; '));
	}
	return result.data!;
}

export async function create(req: Request, res: Response): Promise<void> {
	const { id } = parseOr400(leadIdParamSchema.safeParse(req.params));
	const parsed = parseOr400(createEventoSchema.safeParse(req.body));
	const evento = await eventoService.create({
		leadId: id,
		...parsed,
	});
	res.status(201).json(evento);
}

export async function listByLead(req: Request, res: Response): Promise<void> {
	const { id } = parseOr400(leadIdParamSchema.safeParse(req.params));
	const eventos = await eventoService.listByLead(id);
	res.json(eventos);
}

export async function metricas(req: Request, res: Response): Promise<void> {
	const periodo = parseOr400(periodoQuerySchema.safeParse(req.query));
	const [leadsPorStatus, eventosPorTipo, taxaConversao] = await Promise.all([
		metricasService.leadsPorStatus(),
		metricasService.eventosPorTipo(periodo),
		metricasService.taxaConversao(),
	]);
	res.json({ leadsPorStatus, eventosPorTipo, taxaConversao });
}

export async function agenda(req: Request, res: Response): Promise<void> {
	const periodo = parseOr400(periodoQuerySchema.safeParse(req.query));
	const items = await metricasService.agenda(periodo.de, periodo.ate);
	res.json(items);
}
