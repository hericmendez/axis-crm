import type { StructuredOutput, Intent } from '../types/ai.js';
import type { Lead, LeadStatus } from '../types/lead.js';
import type { EventoTipo } from '../types/evento.js';
import type { OrchestratorResult } from './errors.js';
import type { InternalTool } from './tools/internal-tool.js';
import type { CreateLeadInput } from './tools/create-lead.tool.js';
import type { UpdateLeadInput } from './tools/update-lead.tool.js';
import type { RegisterEventInput } from './tools/register-event.tool.js';
import type { ConsultAgendaInput } from './tools/consult-agenda.tool.js';
import type {
	EventTargetResolution,
	ResolveTargetOptions,
} from '../services/evento.service.js';
import { parseRelativeDateTime } from './date-parser.js';
import { validateDateTime } from './date-validator.js';
import { logger } from '../utils/logger.js';

export interface IntentRouterDeps {
	leadService: {
		create: (userId: string | undefined, input: {
			nome: string;
			telefone: string;
			contatoOrigem: string;
			status?: LeadStatus;
		}) => Promise<Lead>;
		update: (userId: string | undefined, id: string, patch: Record<string, unknown>) => Promise<Lead>;
		getById: (userId: string | undefined, id: string) => Promise<Lead>;
	};
	eventoService: {
		create: (input: {
			leadId: string;
			tipo: EventoTipo;
			data?: Date;
			observacoes?: string;
			userId: string;
		}) => Promise<{ id: string }>;
		resolveTarget: (userId: string | undefined, leadId: string, opts?: ResolveTargetOptions) => Promise<EventTargetResolution>;
	};
	metricasService: {
		agenda: (userId: string | undefined, de: Date, ate: Date) => Promise<unknown[]>;
	};
	leadRepository: {
		findById: (userId: string | undefined, id: string) => Promise<Lead | null>;
		findByTelefone: (userId: string | undefined, telefone: string) => Promise<Lead | null>;
		findByName: (userId: string | undefined, nome: string) => Promise<Lead[]>;
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
	userId: string | undefined,
	deps: IntentRouterDeps,
): Promise<{ status: 'FOUND'; lead: Lead } | { status: 'NOT_FOUND' } | { status: 'AMBIGUOUS'; candidates: Lead[] }> {
	if (ref.leadId) {
		const lead = await deps.leadRepository.findById(userId, ref.leadId);
		return lead ? { status: 'FOUND', lead } : { status: 'NOT_FOUND' };
	}

	if (ref.telefone) {
		const lead = await deps.leadRepository.findByTelefone(userId, ref.telefone);
		return lead ? { status: 'FOUND', lead } : { status: 'NOT_FOUND' };
	}

	if (ref.leadRef) {
		const leads = await deps.leadRepository.findByName(userId, ref.leadRef);
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

const EVENTOS_COM_DATA_OBRIGATORIA: EventoTipo[] = ['AGENDAMENTO', 'REAGENDAMENTO'];

const TIPOS_COM_ALVO: EventoTipo[] = ['REAGENDAMENTO', 'DESISTENCIA', 'NO_SHOW'];

function formatarCandidato(data: Date): string {
	return data.toLocaleString('pt-BR', {
		timeZone: 'America/Sao_Paulo',
		day: '2-digit',
		month: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}

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
	userMessage?: string,
	userId?: string,
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
			const result = await deps.tools.createLead.execute({
				nome: params.nome as string,
				telefone: params.telefone as string,
				contatoOrigem: 'whatsapp',
				...(params.status ? { status: params.status as LeadStatus } : {}),
				...(userId ? { userId } : {}),
			});
			if (result.type === 'SUCCESS' && result.data && typeof result.data === 'object' && 'id' in result.data) {
				return { ...result, leadId: (result.data as { id: string }).id };
			}
			return result;
		}

			case 'ATUALIZAR_LEAD': {
				const resolution = await resolveLead(
					{
						leadId: params.leadId as string | undefined,
						telefone: params.telefone as string | undefined,
						leadRef: params.leadRef as string | undefined,
					},
					userId,
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
					...(userId ? { userId } : {}),
				}).then((result) =>
					result.type === 'SUCCESS' ? { ...result, leadId: resolution.lead.id } : result,
				);
			}

			case 'CONSULTAR_AGENDA': {
				const now = new Date();
				const de = params.de ? new Date(params.de as string) : now;
				const ate = params.ate
					? new Date(params.ate as string)
					: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

				return await deps.tools.consultAgenda.execute({
					de,
					ate,
					...(userId ? { userId } : {}),
				});
			}

		case 'REGISTRAR_EVENTO': {
			const tipo = params.tipo as EventoTipo;

			const resolution = await resolveLead(
				{
					leadId: params.leadId as string | undefined,
					telefone: params.telefone as string | undefined,
					leadRef: params.leadRef as string | undefined,
				},
				userId,
				deps,
			);

			if (resolution.status === 'NOT_FOUND') {
				logger.warn({ intent, tipo, leadRef: params.leadRef }, 'Lead not found');
				return {
					type: 'ENTITY_NOT_FOUND',
					message: 'Lead não encontrado para registrar o evento.',
				};
			}
			if (resolution.status === 'AMBIGUOUS') {
				logger.warn({ intent, tipo, leadRef: params.leadRef, candidates: resolution.candidates.length }, 'Ambiguous lead');
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

		let eventData: Date | undefined;

		if (params.data) {
			const rawDate = String(params.data);
			const dateValidation = validateDateTime(rawDate);
			if (!dateValidation.valid) {
				logger.warn({ intent, tipo, rawDate, reason: dateValidation.code, field: dateValidation.field }, 'Date validation failed');
				return {
					type: dateValidation.code === 'PAST_DATE' ? 'PAST_DATE' : 'INVALID_DATE',
					message: dateValidation.message,
					field: dateValidation.field,
				} as OrchestratorResult;
			}
			eventData = dateValidation.date;
		} else if (userMessage) {
			const parsed = parseRelativeDateTime(userMessage, new Date());
			if (parsed) {
				if (parsed.invalidTime) {
					logger.warn({ intent, tipo, leadRef: params.leadRef }, 'Invalid time from parser');
					return {
						type: 'INVALID_TIME',
						time: userMessage.match(/às?\s*(\S+)/i)?.[1] ?? '',
						message: 'O horário informado é inválido. Informe um horário entre 00:00 e 23:59.',
					} as OrchestratorResult;
				}
				eventData = parsed.date;
			}
		}

		if (EVENTOS_COM_DATA_OBRIGATORIA.includes(tipo) && !eventData) {
			logger.info({ intent, tipo, leadRef: params.leadRef }, 'Missing date for event');
			const nomeLead = resolution.lead.nome;
			return {
				type: 'MISSING_PARAMETERS',
				missing: ['data'],
				message: `Para qual data e horário devo agendar com ${nomeLead}?`,
			};
		}

		if (EVENTOS_COM_DATA_OBRIGATORIA.includes(tipo) && eventData) {
			const now = new Date();
			if (eventData.getTime() <= now.getTime()) {
				logger.info({ intent, tipo, eventData: eventData.toISOString(), now: now.toISOString() }, 'Past date rejected');
				return {
					type: 'PAST_DATE',
					message: 'Essa data já passou. Para qual data e horário você quer agendar?',
				};
			}
		}

				logger.info({ intent, tipo, leadId: resolution.lead.id, hasData: !!eventData, eventData: eventData?.toISOString() }, 'Executing registerEvent tool');

		if (TIPOS_COM_ALVO.includes(tipo)) {
			const eventoIdParam = typeof params.eventoId === 'string' && params.eventoId ? params.eventoId : undefined;
			const dataAlvo = (tipo === 'DESISTENCIA' || tipo === 'NO_SHOW') && eventData ? eventData : undefined;
			const target = await deps.eventoService.resolveTarget(userId, resolution.lead.id, {
				...(eventoIdParam ? { eventoId: eventoIdParam } : {}),
				...(dataAlvo ? { dataAlvo } : {}),
			});

			if (target.status === 'NOT_FOUND') {
				return {
					type: 'ENTITY_NOT_FOUND',
					message: `Não encontrei nenhum agendamento ativo para ${resolution.lead.nome}.`,
				};
			}
			if (target.status === 'ALREADY_RESOLVED') {
				return {
					type: 'ENTITY_NOT_FOUND',
					message: 'Esse compromisso já foi cancelado ou remanejado.',
				};
			}
			if (target.status === 'AMBIGUOUS') {
				return {
					type: 'AMBIGUOUS_ENTITY',
					candidates: target.candidates.map((e) => ({
						id: e.id,
						nome: `${resolution.lead.nome} — ${formatarCandidato(e.data)}`,
						telefone: resolution.lead.telefone,
					})),
					message: `Encontrei ${target.candidates.length} agendamentos ativos para ${resolution.lead.nome}. Qual deles você quer alterar?`,
				};
			}
		}

			return await deps.tools.registerEvent.execute({
					leadId: resolution.lead.id,
					tipo,
					leadNome: resolution.lead.nome,
					...(eventData ? { data: eventData } : {}),
					...(params.observacoes ? { observacoes: params.observacoes as string } : {}),
					...(userId ? { userId } : {}),
				}).then((result) =>
					result.type === 'SUCCESS' ? { ...result, leadId: resolution.lead.id } : result,
				);
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
