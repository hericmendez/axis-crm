import type { InternalTool } from './internal-tool.js';
import type { Lead, LeadStatus } from '../../types/lead.js';

export interface CreateLeadInput {
	nome: string;
	telefone: string;
	contatoOrigem: string;
	status?: LeadStatus;
}

export interface CreateLeadToolDeps {
	leadService: {
		create: (input: {
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
			const result = await deps.leadService.create({
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
