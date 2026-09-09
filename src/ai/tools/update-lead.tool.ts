import type { InternalTool } from './internal-tool.js';
import type { Lead } from '../../types/lead.js';
import { AppError } from '../../utils/errors.js';

export interface UpdateLeadInput {
	leadId: string;
	patch: Record<string, unknown>;
	userId?: string;
}

export interface UpdateLeadToolDeps {
	leadService: {
		update: (userId: string, id: string, patch: Record<string, unknown>) => Promise<Lead>;
	};
}

export function createUpdateLeadTool(deps: UpdateLeadToolDeps): InternalTool<UpdateLeadInput> {
	return {
		async execute(params) {
			if (!params.userId) {
				throw new AppError(401, 'Autenticação necessária');
			}
			const updated = await deps.leadService.update(params.userId, params.leadId, params.patch);
			return {
				type: 'SUCCESS',
				message: `Lead atualizado: ${updated.nome}.`,
				data: updated,
			};
		},
	};
}
