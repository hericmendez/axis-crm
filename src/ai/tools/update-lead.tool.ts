import type { InternalTool } from './internal-tool.js';
import type { Lead } from '../../types/lead.js';

export interface UpdateLeadInput {
	leadId: string;
	patch: Record<string, unknown>;
	userId?: string;
}

export interface UpdateLeadToolDeps {
	leadService: {
		update: (id: string, patch: Record<string, unknown>, userId?: string) => Promise<Lead>;
	};
}

export function createUpdateLeadTool(deps: UpdateLeadToolDeps): InternalTool<UpdateLeadInput> {
	return {
		async execute(params) {
			const updated = await deps.leadService.update(params.leadId, params.patch, params.userId);
			return {
				type: 'SUCCESS',
				message: `Lead atualizado: ${updated.nome}.`,
				data: updated,
			};
		},
	};
}
