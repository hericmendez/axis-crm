import { z } from 'zod';
import { EVENTO_TIPOS } from '../types/evento.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'id inválido');
const isoDate = z.coerce.date();

export const createEventoSchema = z
	.object({
		tipo: z.enum(EVENTO_TIPOS),
		data: isoDate.optional(),
		observacoes: z.string().trim().max(2000).optional(),
		eventoId: objectId.optional(),
	})
	.strip();

export const leadIdParamSchema = z.object({ id: objectId }).strip();

export const eventoIdParamSchema = z.object({ id: objectId, eventoId: objectId }).strip();

export const periodoQuerySchema = z
	.object({
		de: isoDate,
		ate: isoDate,
	})
	.refine((p) => p.de < p.ate, { message: "'de' deve ser anterior a 'ate'" })
	.strip();

export const agendaQuerySchema = periodoQuerySchema;

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

// Range with the same defaults the chat assistant uses (now → +7 days).
export const agendaRangeQuerySchema = z
	.object({
		de: isoDate.optional(),
		ate: isoDate.optional(),
	})
	.strip()
	.transform((q) => {
		const ate = q.ate ?? new Date(Date.now() + SETE_DIAS_MS);
		const de = q.de ?? new Date();
		return { de, ate };
	})
	.refine((p) => p.de < p.ate, { message: "'de' deve ser anterior a 'ate'" });
