import type { InternalTool } from './internal-tool.js';
import type { EventoTipo } from '../../types/evento.js';
import { AppError } from '../../utils/errors.js';

export interface RegisterEventInput {
	leadId: string;
	tipo: EventoTipo;
	leadNome: string;
	data?: Date;
	observacoes?: string;
	userId?: string;
}

export interface RegisterEventToolDeps {
	eventoService: {
		create: (input: {
			leadId: string;
			tipo: EventoTipo;
			data?: Date;
			observacoes?: string;
			userId: string;
		}) => Promise<{ id: string }>;
	};
}

export function createRegisterEventTool(deps: RegisterEventToolDeps): InternalTool<RegisterEventInput> {
	return {
		async execute(params) {
			if (!params.userId) {
				throw new AppError(401, 'Autenticação necessária');
			}
			const evento = await deps.eventoService.create({
				leadId: params.leadId,
				tipo: params.tipo,
				userId: params.userId,
				...(params.data ? { data: params.data } : {}),
				...(params.observacoes ? { observacoes: params.observacoes } : {}),
			});
			return {
				type: 'SUCCESS',
				message: `Evento registrado: ${params.tipo} para ${params.leadNome}.`,
				data: evento,
			};
		},
	};
}
