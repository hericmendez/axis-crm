import type {
	CreateEventoInput,
	Evento,
	EventoTipo,
	Periodo,
} from '../types/evento.js';
import { AppError } from '../utils/errors.js';
import * as leadRepository from '../repositories/lead.repository.js';
import { logger } from '../utils/logger.js';
import * as eventoRepository from '../repositories/evento.repository.js';
import { calendarProjection } from '../integrations/google/calendar/calendar.projection.js';
import { sheetsProjection } from '../integrations/google/sheets/sheets.projection.js';
import { requireTenant } from './tenant.js';

type LeadPatch = Parameters<typeof leadRepository.updateById>[2];

const EFEITO_NO_LEAD: Record<EventoTipo, LeadPatch> = {
	AGENDAMENTO: {},
	REAGENDAMENTO: { status: 'REAGENDADO' },
	VENDA: { status: 'VENDIDO' },
	DESISTENCIA: { status: 'PERDIDO' },
	NO_SHOW: { status: 'NO_SHOW' },
};

function buildPatch(tipo: EventoTipo, dataEvento: Date): LeadPatch {
	const base = EFEITO_NO_LEAD[tipo];
	switch (tipo) {
		case 'AGENDAMENTO':
		case 'REAGENDAMENTO':
			return { ...base, dataAgendamento: dataEvento };
		case 'VENDA':
			return { ...base, dataConversao: dataEvento };
		default:
			return base;
	}
}

const TIPOS_COM_PREDECESSOR: EventoTipo[] = ['REAGENDAMENTO', 'DESISTENCIA', 'NO_SHOW'];

async function resolvePreviousEvento(
	userId: string | undefined,
	leadId: string,
	tipo: EventoTipo,
	eventoId?: string,
): Promise<string | undefined> {
	if (eventoId) {
		if (!TIPOS_COM_PREDECESSOR.includes(tipo)) {
			throw new AppError(400, 'eventoId só se aplica a REAGENDAMENTO, DESISTENCIA ou NO_SHOW.');
		}
		const target = await resolveTarget(userId, leadId, { eventoId });
		if (target.status === 'FOUND') {
			return target.evento.id;
		}
		if (target.status === 'ALREADY_RESOLVED') {
			throw new AppError(404, 'Esse compromisso já foi cancelado ou remanejado.');
		}
		throw new AppError(404, 'Evento não encontrado.');
	}

	if (!TIPOS_COM_PREDECESSOR.includes(tipo)) {
		return undefined;
	}

	const activeEvento = await eventoRepository.findLastActiveForLead(userId, leadId);

	if (!activeEvento) {
		throw new AppError(
			400,
			`Não há agendamento ativo para este lead. Não é possível registrar ${tipo}.`,
		);
	}

	return activeEvento.id;
}

export async function create(input: CreateEventoInput): Promise<Evento> {
	const tenant = requireTenant(input.userId);
	const lead = await leadRepository.findById(tenant, input.leadId);
	if (!lead) {
		throw new AppError(404, 'Lead não encontrado');
	}

	const previousEventoId = await resolvePreviousEvento(tenant, input.leadId, input.tipo, input.eventoId);

	const dataEvento = input.data ?? new Date();
	const { eventoId: _alvoExplicito, ...rest } = input;
	const evento = await eventoRepository.create({
		...rest,
		userId: tenant,
		data: dataEvento,
		...(previousEventoId ? { previousEventoId } : {}),
	});

	const patch = buildPatch(evento.tipo, dataEvento);
	const updated = await leadRepository.updateById(tenant, input.leadId, patch);
	if (!updated) {
		const compensated = await eventoRepository.deleteById(tenant, evento.id);
		logger.error(
			{ eventoId: evento.id, leadId: input.leadId, compensado: compensated },
			'Falha ao aplicar efeitos do evento no lead',
		);
		throw new AppError(500, 'Falha ao aplicar efeitos do evento no lead');
	}

	logger.info({ eventoId: evento.id, tipo: evento.tipo, leadId: input.leadId }, 'Evento registrado');

	try {
		let previousEvento: Evento | null = null;
		if (evento.previousEventoId) {
			previousEvento = await eventoRepository.findById(tenant, evento.previousEventoId);
		}

		await calendarProjection({
			userId: tenant,
			evento,
			lead,
			previousEvento,
		});
	} catch (err) {
		logger.error(
			{ err, eventoId: evento.id, leadId: input.leadId, userId: tenant, tipo: evento.tipo, operation: 'calendarProjection' },
			'Calendar projection failed, domain result preserved',
		);
	}

	try {
		const updatedLead = await leadRepository.findById(tenant, input.leadId);
		if (updatedLead) {
			await sheetsProjection({ userId: tenant, lead: updatedLead });
		}
	} catch (err) {
		logger.error(
			{ err, leadId: input.leadId, userId: tenant, operation: 'sheetsProjection' },
			'Sheets projection failed, domain result preserved',
		);
	}

	return evento;
}

export async function listByLead(userId: string | undefined, leadId: string): Promise<Evento[]> {
	const tenant = requireTenant(userId);
	const lead = await leadRepository.findById(tenant, leadId);
	if (!lead) {
		throw new AppError(404, 'Lead não encontrado');
	}
	return eventoRepository.findByLeadId(tenant, leadId);
}

export async function getById(
	userId: string | undefined,
	leadId: string,
	eventoId: string,
): Promise<Evento> {
	const tenant = requireTenant(userId);
	const lead = await leadRepository.findById(tenant, leadId);
	if (!lead) {
		throw new AppError(404, 'Lead não encontrado');
	}
	const evento = await eventoRepository.findById(tenant, eventoId);
	if (!evento || evento.leadId !== leadId) {
		throw new AppError(404, 'Evento não encontrado');
	}
	return evento;
}

export async function countByTipoInPeriod(userId: string | undefined, periodo: Periodo) {
	const tenant = requireTenant(userId);
	return eventoRepository.countByTipoInPeriod(tenant, periodo);
}

const TIPOS_ATIVOS: EventoTipo[] = ['AGENDAMENTO', 'REAGENDAMENTO'];

const SP_DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'America/Sao_Paulo',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
});

function mesmoDiaSP(a: Date, b: Date): boolean {
	return SP_DAY_FORMAT.format(a) === SP_DAY_FORMAT.format(b);
}

export type EventTargetResolution =
	| { status: 'FOUND'; evento: Evento }
	| { status: 'NOT_FOUND' }
	| { status: 'ALREADY_RESOLVED'; evento: Evento }
	| { status: 'AMBIGUOUS'; candidates: Evento[] };

export interface ResolveTargetOptions {
	eventoId?: string;
	dataAlvo?: Date;
}

export async function resolveTarget(
	userId: string | undefined,
	leadId: string,
	opts: ResolveTargetOptions = {},
): Promise<EventTargetResolution> {
	const tenant = requireTenant(userId);
	if (opts.eventoId) {
		const evento = await eventoRepository.findById(tenant, opts.eventoId);
		if (!evento || evento.leadId !== leadId) {
			return { status: 'NOT_FOUND' };
		}
		if (!TIPOS_ATIVOS.includes(evento.tipo)) {
			return { status: 'ALREADY_RESOLVED', evento };
		}
		const ativos = await eventoRepository.findActiveForLead(tenant, leadId);
		const aindaAtivo = ativos.some((a) => a.id === evento.id);
		return aindaAtivo
			? { status: 'FOUND', evento }
			: { status: 'ALREADY_RESOLVED', evento };
	}

	const ativos = await eventoRepository.findActiveForLead(tenant, leadId);
	const filtrados = opts.dataAlvo
		? ativos.filter((a) => mesmoDiaSP(a.data, opts.dataAlvo as Date))
		: ativos;

	if (filtrados.length === 0) return { status: 'NOT_FOUND' };
	const unico = filtrados[0];
	if (filtrados.length === 1 && unico) return { status: 'FOUND', evento: unico };
	return { status: 'AMBIGUOUS', candidates: filtrados };
}
