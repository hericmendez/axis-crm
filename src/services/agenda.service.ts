import type { Evento, EventoTipo } from '../types/evento.js';
import type { AgendaEventoView, AgendaView, Intervalo } from '../types/agenda.js';
import type { CalendarQueryEvent } from '../integrations/google/calendar/calendar.types.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import * as eventoRepository from '../repositories/evento.repository.js';
import * as leadRepository from '../repositories/lead.repository.js';
import { requireTenant } from './tenant.js';
import { resolveUserCalendarQuery } from '../integrations/google/calendar/calendar-query.resolver.js';

const TIPOS_DE_AGENDA: EventoTipo[] = ['AGENDAMENTO', 'REAGENDAMENTO'];
const DURACAO_EVENTO_MS = 60 * 60 * 1000;
const SP_OFFSET = '-03:00';
const DIA_MS = 24 * 60 * 60 * 1000;

function inicioDoDiaLocal(dataStr: string): Date {
	return new Date(`${dataStr}T00:00:00${SP_OFFSET}`);
}

function eventoDomainParaView(evento: Evento, leadNome?: string): AgendaEventoView {
	const inicio = evento.data;
	const fim = new Date(inicio.getTime() + DURACAO_EVENTO_MS);
	return {
		id: evento.id,
		origem: 'domain',
		titulo: leadNome ?? evento.tipo,
		inicio,
		fim,
		allDay: false,
		tipo: evento.tipo,
		leadId: evento.leadId,
		...(leadNome ? { leadNome } : {}),
		...(evento.googleEventId ? { googleEventId: evento.googleEventId } : {}),
	};
}

function eventoGoogleParaView(evento: CalendarQueryEvent): AgendaEventoView | null {
	if (evento.status === 'cancelled') {
		return null;
	}

	if (evento.startDate) {
		const inicio = inicioDoDiaLocal(evento.startDate);
		const fim = evento.endDate ? inicioDoDiaLocal(evento.endDate) : new Date(inicio.getTime() + DIA_MS);
		return {
			id: evento.id,
			origem: 'google',
			titulo: evento.summary || 'Sem título',
			inicio,
			fim,
			allDay: true,
		};
	}

	if (!evento.start) {
		return null;
	}

	const inicio = new Date(evento.start);
	const fim = evento.end ? new Date(evento.end) : new Date(inicio.getTime() + DURACAO_EVENTO_MS);
	return {
		id: evento.id,
		origem: 'google',
		titulo: evento.summary || 'Sem título',
		inicio,
		fim,
		allDay: false,
	};
}

export function fundirEventos(
	domain: AgendaEventoView[],
	google: AgendaEventoView[],
): AgendaEventoView[] {
	const googlePorId = new Map(google.map((g) => [g.id, g]));
	const fundidos: AgendaEventoView[] = [];

	for (const d of domain) {
		const g = d.googleEventId ? googlePorId.get(d.googleEventId) : undefined;
		if (g) {
			googlePorId.delete(g.id);
			fundidos.push({
				...d,
				inicio: g.inicio,
				fim: g.fim,
				allDay: g.allDay,
			});
		} else {
			fundidos.push(d);
		}
	}

	fundidos.push(...googlePorId.values());

	return fundidos.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

export function calcularOcupacao(eventos: AgendaEventoView[], de: Date, ate: Date): Intervalo[] {
	const deMs = de.getTime();
	const ateMs = ate.getTime();

	const intervalos = eventos
		.filter((e) => e.inicio.getTime() < ateMs && e.fim.getTime() > deMs)
		.map((e) => ({
			inicio: e.inicio.getTime() > deMs ? e.inicio : de,
			fim: e.fim.getTime() < ateMs ? e.fim : ate,
		}))
		.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

	const ocupacao: Intervalo[] = [];
	for (const intervalo of intervalos) {
		const ultimo = ocupacao[ocupacao.length - 1];
		if (ultimo && intervalo.inicio.getTime() <= ultimo.fim.getTime()) {
			if (intervalo.fim.getTime() > ultimo.fim.getTime()) {
				ultimo.fim = intervalo.fim;
			}
		} else {
			ocupacao.push({ inicio: intervalo.inicio, fim: intervalo.fim });
		}
	}

	return ocupacao;
}

export function calcularDisponibilidade(ocupacao: Intervalo[], de: Date, ate: Date): Intervalo[] {
	const livres: Intervalo[] = [];
	let cursor = de.getTime();
	const fimPeriodo = ate.getTime();

	for (const ocupado of ocupacao) {
		const inicio = ocupado.inicio.getTime();
		const fim = ocupado.fim.getTime();
		if (inicio > cursor) {
			livres.push({ inicio: new Date(cursor), fim: new Date(inicio) });
		}
		if (fim > cursor) {
			cursor = fim;
		}
	}

	if (cursor < fimPeriodo) {
		livres.push({ inicio: new Date(cursor), fim: new Date(fimPeriodo) });
	}

	return livres;
}

export async function consultarAgenda(
	userId: string | undefined,
	de: Date,
	ate: Date,
): Promise<AgendaView> {
	const tenant = requireTenant(userId);
	if (!(de.getTime() < ate.getTime())) {
		throw new AppError(400, 'Período inválido: o início deve ser anterior ao fim.');
	}

	const eventosDomain = await eventoRepository.findByDataPeriodo(
		tenant,
		new Date(de.getTime() - DURACAO_EVENTO_MS),
		ate,
	);

	const leadIds = [...new Set(eventosDomain.map((e) => e.leadId))];
	const leadsPorId = new Map<string, string>();
	for (const leadId of leadIds) {
		const lead = await leadRepository.findById(tenant, leadId);
		if (lead) {
			leadsPorId.set(leadId, lead.nome);
		}
	}

	const domainViews = eventosDomain
		.filter((e) => TIPOS_DE_AGENDA.includes(e.tipo))
		.filter(
			(e) =>
				e.data.getTime() < ate.getTime() &&
				new Date(e.data.getTime() + DURACAO_EVENTO_MS).getTime() > de.getTime(),
		)
		.map((e) => eventoDomainParaView(e, leadsPorId.get(e.leadId)));

	let googleViews: AgendaEventoView[] = [];
	let calendarStatus: AgendaView['calendarStatus'] = 'OK';

	try {
		const resolution = await resolveUserCalendarQuery(tenant);
		if (resolution.status === 'OK') {
			const googleEvents = await resolution.adapter.queryEvents({
				timeMin: de.toISOString(),
				timeMax: ate.toISOString(),
			});
			googleViews = googleEvents
				.map(eventoGoogleParaView)
				.filter((v): v is AgendaEventoView => v !== null);
		} else {
			calendarStatus = resolution.status;
			logger.warn(
				{ userId: tenant, status: resolution.status },
				'Google Calendar indisponível para consulta de agenda',
			);
		}
	} catch (err) {
		calendarStatus = 'UNAVAILABLE';
		logger.error(
			{ err, userId: tenant },
			'Falha ao consultar Google Calendar; agenda parcial (apenas MongoDB)',
		);
	}

	const eventos = fundirEventos(domainViews, googleViews);
	const ocupacao = calcularOcupacao(eventos, de, ate);
	const disponibilidade = calcularDisponibilidade(ocupacao, de, ate);

	return { de, ate, eventos, ocupacao, disponibilidade, calendarStatus };
}
