import type { StructuredOutput, Intent } from '../types/ai.js';
import type { Lead, LeadStatus } from '../types/lead.js';
import type { EventoTipo } from '../types/evento.js';
import type { OrchestratorResult } from './errors.js';
import type { InternalTool } from './tools/internal-tool.js';
import type { CreateLeadInput } from './tools/create-lead.tool.js';
import type { UpdateLeadInput } from './tools/update-lead.tool.js';
import type { RegisterEventInput } from './tools/register-event.tool.js';
import type { ConsultAgendaInput } from './tools/consult-agenda.tool.js';

export interface IntentRouterDeps {
	leadService: {
		create: (input: {
			nome: string;
			telefone: string;
			contatoOrigem: string;
			status?: LeadStatus;
		}) => Promise<Lead>;
		update: (id: string, patch: Record<string, unknown>) => Promise<Lead>;
		getById: (id: string) => Promise<Lead>;
	};
	eventoService: {
		create: (input: {
			leadId: string;
			tipo: EventoTipo;
			data?: Date;
			observacoes?: string;
		}) => Promise<{ id: string }>;
	};
	metricasService: {
		agenda: (de: Date, ate: Date) => Promise<unknown[]>;
	};
	leadRepository: {
		findById: (id: string) => Promise<Lead | null>;
		findByTelefone: (telefone: string) => Promise<Lead | null>;
		findByName: (nome: string) => Promise<Lead[]>;
	};
	tools: {
		createLead: InternalTool<CreateLeadInput>;
		updateLead: InternalTool<UpdateLeadInput>;
		registerEvent: InternalTool<RegisterEventInput>;
		consultAgenda: InternalTool<ConsultAgendaInput>;
	};
}

async function resolveLead(
	ref: { leadId?: string; telefone?: string; leadRef?: string },
	deps: IntentRouterDeps,
): Promise<{ status: 'FOUND'; lead: Lead } | { status: 'NOT_FOUND' } | { status: 'AMBIGUOUS'; candidates: Lead[] }> {
	if (ref.leadId) {
		const lead = await deps.leadRepository.findById(ref.leadId);
		return lead ? { status: 'FOUND', lead } : { status: 'NOT_FOUND' };
	}

	if (ref.telefone) {
		const lead = await deps.leadRepository.findByTelefone(ref.telefone);
		return lead ? { status: 'FOUND', lead } : { status: 'NOT_FOUND' };
	}

	if (ref.leadRef) {
		const leads = await deps.leadRepository.findByName(ref.leadRef);
		if (leads.length === 0) return { status: 'NOT_FOUND' as const };
		if (leads.length === 1) {
			const lead = leads[0];
			if (!lead) return { status: 'NOT_FOUND' as const };
			return { status: 'FOUND' as const, lead };
		}
		return { status: 'AMBIGUOUS' as const, candidates: leads };
	}

	return { status: 'NOT_FOUND' as const };
}

const REQUIRED_PARAMS: Record<Intent, string[]> = {
	CRIAR_LEAD: ['nome', 'telefone'],
	ATUALIZAR_LEAD: [],
	CONSULTAR_AGENDA: [],
	REGISTRAR_EVENTO: ['tipo'],
	CONVERSAR: [],
};

const ENTITY_REF_INTENTS: Intent[] = ['ATUALIZAR_LEAD', 'REGISTRAR_EVENTO'];

function validateParams(
	intent: Intent,
	params: Record<string, unknown>,
): { valid: true } | { valid: false; missing: string[] } {
	const required = REQUIRED_PARAMS[intent];
	const missing = required.filter(
		(key) => params[key] === undefined || params[key] === null || params[key] === '',
	);

	if (ENTITY_REF_INTENTS.includes(intent)) {
		const hasRef =
			params.leadId || params.telefone || params.leadRef;
		if (!hasRef) {
			missing.push('leadId, telefone ou leadRef');
		}
	}

	return missing.length === 0 ? { valid: true } : { valid: false, missing };
}

export async function routeIntent(
	output: StructuredOutput,
	deps: IntentRouterDeps,
): Promise<OrchestratorResult> {
	if (output.mode === 'CHAT') {
		return { type: 'SUCCESS', message: output.response };
	}

	const { intent, parameters } = output;

	if (!(intent in REQUIRED_PARAMS)) {
		return {
			type: 'INVALID_INTENT',
			message: 'Não foi possível processar essa intenção.',
		};
	}

	const validation = validateParams(intent, parameters as Record<string, unknown>);
	if (!validation.valid) {
		return {
			type: 'MISSING_PARAMETERS',
			missing: validation.missing,
			message: `Parâmetros ausentes: ${validation.missing.join(', ')}`,
		};
	}

	const params = parameters as Record<string, unknown>;

	try {
		switch (intent) {
			case 'CRIAR_LEAD': {
				return await deps.tools.createLead.execute({
					nome: params.nome as string,
					telefone: params.telefone as string,
					contatoOrigem: 'whatsapp',
					...(params.status ? { status: params.status as LeadStatus } : {}),
				});
			}

			case 'ATUALIZAR_LEAD': {
				const resolution = await resolveLead(
					{
						leadId: params.leadId as string | undefined,
						telefone: params.telefone as string | undefined,
						leadRef: params.leadRef as string | undefined,
					},
					deps,
				);

				if (resolution.status === 'NOT_FOUND') {
					return {
						type: 'ENTITY_NOT_FOUND',
						message: 'Lead não encontrado.',
					};
				}
				if (resolution.status === 'AMBIGUOUS') {
					return {
						type: 'AMBIGUOUS_ENTITY',
						candidates: resolution.candidates.map((l) => ({
							id: l.id,
							nome: l.nome,
							telefone: l.telefone,
						})),
						message: `Encontrei ${resolution.candidates.length} leads com esse nome. Qual deles você quer atualizar?`,
					};
				}

				const patch: Record<string, unknown> = {};
				if (params.nome) patch.nome = params.nome;
				if (params.status) patch.status = params.status;
				if (params.email) patch.email = params.email;
				if (params.senioridade) patch.senioridade = params.senioridade;
				if (params.renda) patch.renda = params.renda;
				if (params.observacoes) patch.observacoes = params.observacoes;

				return await deps.tools.updateLead.execute({
					leadId: resolution.lead.id,
					patch,
				});
			}

			case 'CONSULTAR_AGENDA': {
				const now = new Date();
				const de = params.de ? new Date(params.de as string) : now;
				const ate = params.ate
					? new Date(params.ate as string)
					: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

				return await deps.tools.consultAgenda.execute({ de, ate });
			}

			case 'REGISTRAR_EVENTO': {
				const resolution = await resolveLead(
					{
						leadId: params.leadId as string | undefined,
						telefone: params.telefone as string | undefined,
						leadRef: params.leadRef as string | undefined,
					},
					deps,
				);

				if (resolution.status === 'NOT_FOUND') {
					return {
						type: 'ENTITY_NOT_FOUND',
						message: 'Lead não encontrado para registrar o evento.',
					};
				}
				if (resolution.status === 'AMBIGUOUS') {
					return {
						type: 'AMBIGUOUS_ENTITY',
						candidates: resolution.candidates.map((l) => ({
							id: l.id,
							nome: l.nome,
							telefone: l.telefone,
						})),
						message: `Encontrei ${resolution.candidates.length} leads com esse nome. Qual deles você quer registrar o evento?`,
					};
				}

				return await deps.tools.registerEvent.execute({
					leadId: resolution.lead.id,
					tipo: params.tipo as EventoTipo,
					leadNome: resolution.lead.nome,
					...(params.data ? { data: new Date(params.data as string) } : {}),
					...(params.observacoes ? { observacoes: params.observacoes as string } : {}),
				});
			}

			case 'CONVERSAR': {
				return { type: 'SUCCESS', message: '' };
			}

			default: {
				return {
					type: 'INVALID_INTENT',
					message: 'Não foi possível processar essa intenção.',
				};
			}
		}
	} catch (err) {
		const message =
			err instanceof Error ? err.message : 'Erro desconhecido';
		return {
			type: 'SERVICE_ERROR',
			message: `Erro ao processar: ${message}`,
		};
	}
}
