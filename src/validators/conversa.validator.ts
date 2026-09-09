import { z } from 'zod';
import { CONVERSA_CANAIS } from '../types/conversa.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'id inválido');

export const conversaIdParamSchema = z.object({ id: objectId }).strip();

export const listConversasQuerySchema = z
	.object({
		leadId: objectId.optional(),
		canal: z.enum(CONVERSA_CANAIS).optional(),
		chatIdExterno: z.string().trim().min(1).max(200).optional(),
		page: z.coerce.number().int().positive().default(1),
		limit: z.coerce.number().int().positive().max(100).default(20),
	})
	.strip();

export const conversaDetailQuerySchema = z
	.object({
		limit: z.coerce.number().int().positive().max(200).default(50),
	})
	.strip();
