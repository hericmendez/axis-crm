import type { Request, Response } from 'express';
import * as eventoService from '../services/evento.service.js';
import * as metricasService from '../services/metricas.service.js';
import * as agendaService from '../services/agenda.service.js';
import {
	agendaRangeQuerySchema,
	createEventoSchema,
	eventoIdParamSchema,
	leadIdParamSchema,
	periodoQuerySchema,
} from '../validators/evento.validator.js';
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

export async function create(req: Request, res: Response): Promise<void> {
	const userId = requireUserId(req);
	const { id } = parseOr400(leadIdParamSchema.safeParse(req.params));
	const parsed = parseOr400(createEventoSchema.safeParse(req.body));
	const evento = await eventoService.create({
		...parsed,
		leadId: id,
		userId,
	});
	res.status(201).json(evento);
}

export async function listByLead(req: Request, res: Response): Promise<void> {
	const userId = requireUserId(req);
	const { id } = parseOr400(leadIdParamSchema.safeParse(req.params));
	const eventos = await eventoService.listByLead(userId, id);
	res.json(eventos);
}

export async function getById(req: Request, res: Response): Promise<void> {
	const userId = requireUserId(req);
	const { id, eventoId } = parseOr400(eventoIdParamSchema.safeParse(req.params));
	const evento = await eventoService.getById(userId, id, eventoId);
	res.json(evento);
}

export async function metricas(req: Request, res: Response): Promise<void> {
	const userId = requireUserId(req);
	const periodo = parseOr400(periodoQuerySchema.safeParse(req.query));
	const [leadsPorStatus, eventosPorTipo, taxaConversao] = await Promise.all([
		metricasService.leadsPorStatus(userId),
		metricasService.eventosPorTipo(userId, periodo),
		metricasService.taxaConversao(userId),
	]);
	res.json({ leadsPorStatus, eventosPorTipo, taxaConversao });
}

export async function agenda(req: Request, res: Response): Promise<void> {
	const userId = requireUserId(req);
	const periodo = parseOr400(periodoQuerySchema.safeParse(req.query));
	const items = await metricasService.agenda(userId, periodo.de, periodo.ate);
	res.json(items);
}

// Modern agenda: same merged view (MongoDB + Google Calendar) the chat
// assistant uses. Legacy GET /api/agenda above is frozen for compatibility.
export async function agendaV1(req: Request, res: Response): Promise<void> {
	const userId = requireUserId(req);
	const periodo = parseOr400(agendaRangeQuerySchema.safeParse(req.query));
	const view = await agendaService.consultarAgenda(userId, periodo.de, periodo.ate);
	res.json(view);
}
