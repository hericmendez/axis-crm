import { z } from 'zod';

const isoDate = z.coerce.date();

export const createLeadSchema = z
	.object({
		nome: z.string().trim().min(1),
		telefone: z.string().trim().min(1),
		email: z.string().email().optional(),
		contatoOrigem: z.string().trim().min(1),
		senioridade: z.string().trim().optional(),
		renda: z.number().min(0).optional(),
		status: z.enum(['AGENDADO', 'VENDIDO', 'PERDIDO', 'NO_SHOW', 'REAGENDADO']).optional(),
		dataAgendamento: isoDate.optional(),
		dataConversao: isoDate.optional(),
		tipoFechamento: z.string().trim().optional(),
		observacoes: z.string().optional(),
	})
	.strip();

// telefone é imutável após a criação do lead
export const updateLeadSchema = createLeadSchema
	.omit({ telefone: true })
	.partial()
	.refine((obj) => Object.keys(obj).length > 0, { message: 'Patch não pode ser vazio' });

export const listLeadsQuerySchema = z
	.object({
		status: z.enum(['AGENDADO', 'VENDIDO', 'PERDIDO', 'NO_SHOW', 'REAGENDADO']).optional(),
		page: z.coerce.number().int().positive().default(1),
		limit: z.coerce.number().int().positive().max(100).default(20),
	})
	.strip();
