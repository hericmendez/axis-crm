import { z } from 'zod';
import { EVENTO_TIPOS } from '../types/evento.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'id inválido');
const isoDate = z.coerce.date();

export const createEventoSchema = z
	.object({
		tipo: z.enum(EVENTO_TIPOS),
		data: isoDate.optional(),
		observacoes: z.string().trim().optional(),
	})
	.strip();

export const leadIdParamSchema = z.object({ id: objectId }).strip();

export const periodoQuerySchema = z
	.object({
		de: isoDate,
		ate: isoDate,
	})
	.refine((p) => p.de < p.ate, { message: "'de' deve ser anterior a 'ate'" })
	.strip();

export const agendaQuerySchema = periodoQuerySchema;
