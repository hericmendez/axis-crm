import type { InternalTool } from './internal-tool.js';
import type { Lead, LeadStatus } from '../../types/lead.js';
import { AppError } from '../../utils/errors.js';

export interface CreateLeadInput {
	nome: string;
	telefone: string;
	contatoOrigem: string;
	status?: LeadStatus;
	userId?: string;
}

export interface CreateLeadToolDeps {
	leadService: {
		create: (userId: string, input: {
			nome: string;
			telefone: string;
			contatoOrigem: string;
			status?: LeadStatus;
		}) => Promise<Lead>;
	};
}

export function createCreateLeadTool(deps: CreateLeadToolDeps): InternalTool<CreateLeadInput> {
	return {
		async execute(params) {
			if (!params.userId) {
				throw new AppError(401, 'Autenticação necessária');
			}
			const result = await deps.leadService.create(params.userId, {
				nome: params.nome,
				telefone: params.telefone,
				contatoOrigem: params.contatoOrigem,
				...(params.status ? { status: params.status } : {}),
			});
			return {
				type: 'SUCCESS',
				message: `Lead criado: ${result.nome} (${result.telefone}).`,
				data: result,
			};
		},
	};
}
