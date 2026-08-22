import { z } from 'zod';
import { LEAD_STATUS } from '../types/lead.js';

const isoDate = z.coerce.date();
const statusEnum = z.enum(LEAD_STATUS);

export const createLeadSchema = z
	.object({
		nome: z.string().trim().min(1).max(200),
		telefone: z.string().trim().min(1).max(30),
		email: z.string().email().max(254).optional(),
		contatoOrigem: z.string().trim().min(1).max(100),
		senioridade: z.string().trim().max(100).optional(),
		renda: z.number().min(0).optional(),
		status: statusEnum.optional(),
		dataAgendamento: isoDate.optional(),
		dataConversao: isoDate.optional(),
		tipoFechamento: z.string().trim().max(100).optional(),
		observacoes: z.string().max(2000).optional(),
	})
	.strip();

// telefone é imutável após a criação do lead
export const updateLeadSchema = createLeadSchema
	.omit({ telefone: true })
	.partial()
	.refine((obj) => Object.keys(obj).length > 0, { message: 'Patch não pode ser vazio' });

export const listLeadsQuerySchema = z
	.object({
		status: statusEnum.optional(),
		page: z.coerce.number().int().positive().default(1),
		limit: z.coerce.number().int().positive().max(100).default(20),
	})
	.strip();
