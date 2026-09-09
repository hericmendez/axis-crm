/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Evento } from '../../src/types/evento.js';
import type { AgendaEventoView } from '../../src/types/agenda.js';

vi.mock('../../src/repositories/evento.repository.js', () => ({
	findByDataPeriodo: vi.fn(),
}));

vi.mock('../../src/repositories/lead.repository.js', () => ({
	findById: vi.fn(),
}));

vi.mock('../../src/integrations/google/calendar/calendar-query.resolver.js', () => ({
	resolveUserCalendarQuery: vi.fn(),
}));

import {
	fundirEventos,
	calcularOcupacao,
	calcularDisponibilidade,
	consultarAgenda,
} from '../../src/services/agenda.service.js';
import * as eventoRepository from '../../src/repositories/evento.repository.js';
import * as leadRepository from '../../src/repositories/lead.repository.js';
import { resolveUserCalendarQuery } from '../../src/integrations/google/calendar/calendar-query.resolver.js';

const DE = new Date('2026-09-10T00:00:00-03:00');
const ATE = new Date('2026-09-11T00:00:00-03:00');

function makeEvento(overrides: Partial<Evento> = {}): Evento {
	return {
		id: '507f1f77bcf86cd799439011',
		leadId: '507f1f77bcf86cd799439022',
		tipo: 'AGENDAMENTO',
		data: new Date('2026-09-10T14:00:00-03:00'),
		createdAt: new Date('2026-09-01T10:00:00-03:00'),
		...overrides,
	};
}

function makeGoogleEvent(overrides: Record<string, any> = {}): any {
	return {
		id: 'gcal-event-1',
		summary: 'Reunião externa',
		start: '2026-09-10T09:00:00-03:00',
		end: '2026-09-10T10:00:00-03:00',
		startDate: undefined,
		endDate: undefined,
		status: 'confirmed',
		...overrides,
	};
}

function makeDomainView(overrides: Partial<AgendaEventoView> = {}): AgendaEventoView {
	return {
		id: 'evento-1',
		origem: 'domain',
		titulo: 'João',
		inicio: new Date('2026-09-10T14:00:00-03:00'),
		fim: new Date('2026-09-10T15:00:00-03:00'),
		allDay: false,
		tipo: 'AGENDAMENTO',
		leadId: 'lead-1',
		leadNome: 'João',
		googleEventId: 'gcal-matched',
		...overrides,
	};
}

function makeGoogleView(overrides: Partial<AgendaEventoView> = {}): AgendaEventoView {
	return {
		id: 'gcal-externo',
		origem: 'google',
		titulo: 'Compromisso externo',
		inicio: new Date('2026-09-10T09:00:00-03:00'),
		fim: new Date('2026-09-10T10:00:00-03:00'),
		allDay: false,
		...overrides,
	};
}

function mockAdapterOk(events: any[]) {
	const queryEvents = vi.fn().mockResolvedValue(events);
	vi.mocked(resolveUserCalendarQuery).mockResolvedValue({
		status: 'OK',
		adapter: { queryEvents },
	} as any);
	return queryEvents;
}

describe('fundirEventos', () => {
	it('mescla evento domain com google pelo googleEventId', () => {
		const domain = [makeDomainView({ googleEventId: 'gcal-1', inicio: new Date('2026-09-10T14:00:00-03:00'), fim: new Date('2026-09-10T15:00:00-03:00') })];
		const google = [makeGoogleView({ id: 'gcal-1', inicio: new Date('2026-09-10T16:00:00-03:00'), fim: new Date('2026-09-10T17:00:00-03:00') })];

		const result = fundirEventos(domain, google);

		expect(result).toHaveLength(1);
		expect(result[0].origem).toBe('domain');
		expect(result[0].leadNome).toBe('João');
		expect(result[0].tipo).toBe('AGENDAMENTO');
		expect(result[0].inicio.getTime()).toBe(new Date('2026-09-10T16:00:00-03:00').getTime());
		expect(result[0].fim.getTime()).toBe(new Date('2026-09-10T17:00:00-03:00').getTime());
	});

	it('mantém evento domain sem googleEventId', () => {
		const domain = [makeDomainView({ id: 'evento-2', googleEventId: undefined })];
		const google: AgendaEventoView[] = [];

		const result = fundirEventos(domain, google);

		expect(result).toHaveLength(1);
		expect(result[0].origem).toBe('domain');
		expect(result[0].id).toBe('evento-2');
	});

	it('mantém evento domain cujo googleEventId não está no Calendar', () => {
		const domain = [makeDomainView({ googleEventId: 'gcal-excluido' })];
		const google: AgendaEventoView[] = [];

		const result = fundirEventos(domain, google);

		expect(result).toHaveLength(1);
		expect(result[0].origem).toBe('domain');
	});

	it('mantém evento existente apenas no Google', () => {
		const domain: AgendaEventoView[] = [];
		const google = [makeGoogleView()];

		const result = fundirEventos(domain, google);

		expect(result).toHaveLength(1);
		expect(result[0].origem).toBe('google');
		expect(result[0].id).toBe('gcal-externo');
	});

	it('não duplica quando domain e google apontam para o mesmo evento', () => {
		const domain = [makeDomainView({ googleEventId: 'gcal-1' })];
		const google = [makeGoogleView({ id: 'gcal-1' })];

		const result = fundirEventos(domain, google);

		expect(result).toHaveLength(1);
	});

	it('ordena eventos por início', () => {
		const domain = [makeDomainView({ id: 'd-tarde', inicio: new Date('2026-09-10T18:00:00-03:00'), fim: new Date('2026-09-10T19:00:00-03:00'), googleEventId: undefined })];
		const google = [makeGoogleView({ id: 'g-manha', inicio: new Date('2026-09-10T08:00:00-03:00'), fim: new Date('2026-09-10T09:00:00-03:00') })];

		const result = fundirEventos(domain, google);

		expect(result).toHaveLength(2);
		expect(result[0].id).toBe('g-manha');
		expect(result[1].id).toBe('d-tarde');
	});
});

describe('calcularOcupacao', () => {
	it('mantém intervalos disjuntos separados', () => {
		const eventos = [
			makeDomainView({ inicio: new Date('2026-09-10T09:00:00-03:00'), fim: new Date('2026-09-10T10:00:00-03:00'), googleEventId: undefined }),
			makeDomainView({ id: 'e2', inicio: new Date('2026-09-10T14:00:00-03:00'), fim: new Date('2026-09-10T15:00:00-03:00'), googleEventId: undefined }),
		];

		const ocupacao = calcularOcupacao(eventos, DE, ATE);

		expect(ocupacao).toHaveLength(2);
	});

	it('mescla eventos sobrepostos em um intervalo único', () => {
		const eventos = [
			makeDomainView({ inicio: new Date('2026-09-10T09:00:00-03:00'), fim: new Date('2026-09-10T11:00:00-03:00'), googleEventId: undefined }),
			makeDomainView({ id: 'e2', inicio: new Date('2026-09-10T10:00:00-03:00'), fim: new Date('2026-09-10T12:00:00-03:00'), googleEventId: undefined }),
		];

		const ocupacao = calcularOcupacao(eventos, DE, ATE);

		expect(ocupacao).toHaveLength(1);
		expect(ocupacao[0].inicio.getTime()).toBe(new Date('2026-09-10T09:00:00-03:00').getTime());
		expect(ocupacao[0].fim.getTime()).toBe(new Date('2026-09-10T12:00:00-03:00').getTime());
	});

	it('mescla eventos encostados (fim == início do próximo)', () => {
		const eventos = [
			makeDomainView({ inicio: new Date('2026-09-10T09:00:00-03:00'), fim: new Date('2026-09-10T10:00:00-03:00'), googleEventId: undefined }),
			makeDomainView({ id: 'e2', inicio: new Date('2026-09-10T10:00:00-03:00'), fim: new Date('2026-09-10T11:00:00-03:00'), googleEventId: undefined }),
		];

		const ocupacao = calcularOcupacao(eventos, DE, ATE);

		expect(ocupacao).toHaveLength(1);
		expect(ocupacao[0].fim.getTime()).toBe(new Date('2026-09-10T11:00:00-03:00').getTime());
	});

	it('recorta intervalos para os limites do período', () => {
		const eventos = [
			makeDomainView({ inicio: new Date('2026-09-09T22:00:00-03:00'), fim: new Date('2026-09-10T02:00:00-03:00'), googleEventId: undefined }),
		];

		const ocupacao = calcularOcupacao(eventos, DE, ATE);

		expect(ocupacao).toHaveLength(1);
		expect(ocupacao[0].inicio.getTime()).toBe(DE.getTime());
		expect(ocupacao[0].fim.getTime()).toBe(new Date('2026-09-10T02:00:00-03:00').getTime());
	});

	it('exclui eventos fora do período', () => {
		const eventos = [
			makeDomainView({ inicio: new Date('2026-09-11T09:00:00-03:00'), fim: new Date('2026-09-11T10:00:00-03:00'), googleEventId: undefined }),
			makeDomainView({ id: 'e2', inicio: new Date('2026-09-08T09:00:00-03:00'), fim: new Date('2026-09-08T10:00:00-03:00'), googleEventId: undefined }),
		];

		const ocupacao = calcularOcupacao(eventos, DE, ATE);

		expect(ocupacao).toHaveLength(0);
	});

	it('evento all-day cobre o dia inteiro', () => {
		const eventos = [makeGoogleView({ allDay: true, inicio: new Date('2026-09-10T00:00:00-03:00'), fim: new Date('2026-09-11T00:00:00-03:00') })];

		const ocupacao = calcularOcupacao(eventos, DE, ATE);

		expect(ocupacao).toHaveLength(1);
		expect(ocupacao[0].inicio.getTime()).toBe(DE.getTime());
		expect(ocupacao[0].fim.getTime()).toBe(ATE.getTime());
	});
});

describe('calcularDisponibilidade', () => {
	it('período totalmente livre retorna o período completo', () => {
		const livres = calcularDisponibilidade([], DE, ATE);

		expect(livres).toHaveLength(1);
		expect(livres[0].inicio.getTime()).toBe(DE.getTime());
		expect(livres[0].fim.getTime()).toBe(ATE.getTime());
	});

	it('período totalmente ocupado retorna vazio', () => {
		const ocupacao = [{ inicio: DE, fim: ATE }];

		const livres = calcularDisponibilidade(ocupacao, DE, ATE);

		expect(livres).toHaveLength(0);
	});

	it('evento no meio cria dois intervalos livres', () => {
		const ocupacao = [
			{ inicio: new Date('2026-09-10T09:00:00-03:00'), fim: new Date('2026-09-10T11:00:00-03:00') },
		];

		const livres = calcularDisponibilidade(ocupacao, DE, ATE);

		expect(livres).toHaveLength(2);
		expect(livres[0].fim.getTime()).toBe(new Date('2026-09-10T09:00:00-03:00').getTime());
		expect(livres[1].inicio.getTime()).toBe(new Date('2026-09-10T11:00:00-03:00').getTime());
		expect(livres[1].fim.getTime()).toBe(ATE.getTime());
	});

	it('ocupação começando exatamente em `de` não gera intervalo inicial', () => {
		const ocupacao = [
			{ inicio: DE, fim: new Date('2026-09-10T09:00:00-03:00') },
		];

		const livres = calcularDisponibilidade(ocupacao, DE, ATE);

		expect(livres).toHaveLength(1);
		expect(livres[0].inicio.getTime()).toBe(new Date('2026-09-10T09:00:00-03:00').getTime());
	});

	it('ocupação terminando exatamente em `ate` não gera intervalo final', () => {
		const ocupacao = [
			{ inicio: new Date('2026-09-10T09:00:00-03:00'), fim: ATE },
		];

		const livres = calcularDisponibilidade(ocupacao, DE, ATE);

		expect(livres).toHaveLength(1);
		expect(livres[0].fim.getTime()).toBe(new Date('2026-09-10T09:00:00-03:00').getTime());
	});

	it('múltiplas ocupações produzem os complementos corretos', () => {
		const ocupacao = [
			{ inicio: new Date('2026-09-10T08:00:00-03:00'), fim: new Date('2026-09-10T10:00:00-03:00') },
			{ inicio: new Date('2026-09-10T12:00:00-03:00'), fim: new Date('2026-09-10T14:00:00-03:00') },
		];

		const livres = calcularDisponibilidade(ocupacao, DE, ATE);

		expect(livres).toHaveLength(3);
		expect(livres[0].fim.getTime()).toBe(new Date('2026-09-10T08:00:00-03:00').getTime());
		expect(livres[1].inicio.getTime()).toBe(new Date('2026-09-10T10:00:00-03:00').getTime());
		expect(livres[1].fim.getTime()).toBe(new Date('2026-09-10T12:00:00-03:00').getTime());
		expect(livres[2].inicio.getTime()).toBe(new Date('2026-09-10T14:00:00-03:00').getTime());
	});
});

describe('consultarAgenda', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(eventoRepository.findByDataPeriodo).mockResolvedValue([]);
		vi.mocked(leadRepository.findById).mockResolvedValue(null);
	});

	it('rejeita período inválido (de >= ate)', async () => {
		await expect(consultarAgenda('507f1f77bcf86cd799439011', ATE, DE)).rejects.toMatchObject({ statusCode: 400 });
		await expect(consultarAgenda('507f1f77bcf86cd799439011', DE, DE)).rejects.toMatchObject({ statusCode: 400 });
	});

	it('agenda vazia: nenhum evento, período totalmente livre, status OK', async () => {
		mockAdapterOk([]);

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.eventos).toEqual([]);
		expect(view.ocupacao).toEqual([]);
		expect(view.disponibilidade).toHaveLength(1);
		expect(view.disponibilidade[0].inicio.getTime()).toBe(DE.getTime());
		expect(view.disponibilidade[0].fim.getTime()).toBe(ATE.getTime());
		expect(view.calendarStatus).toBe('OK');
		expect(eventoRepository.findByDataPeriodo).toHaveBeenCalledWith(
			'507f1f77bcf86cd799439011',
			new Date(DE.getTime() - 60 * 60 * 1000),
			ATE,
		);
	});

	it('consulta o Calendar com timeMin/timeMax ISO do período', async () => {
		const queryEvents = mockAdapterOk([]);

		await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(queryEvents).toHaveBeenCalledWith({
			timeMin: DE.toISOString(),
			timeMax: ATE.toISOString(),
		});
	});

	it('sem userId: falha fechado com 401 sem consultar repositórios', async () => {
		await expect(consultarAgenda(undefined, DE, ATE)).rejects.toMatchObject({ statusCode: 401 });
		expect(eventoRepository.findByDataPeriodo).not.toHaveBeenCalled();
		expect(resolveUserCalendarQuery).not.toHaveBeenCalled();
	});

	it('sem GoogleConnection: status NO_CONNECTION com eventos do domínio', async () => {
		vi.mocked(eventoRepository.findByDataPeriodo).mockResolvedValue([makeEvento()]);
		vi.mocked(resolveUserCalendarQuery).mockResolvedValue({ status: 'NO_CONNECTION' } as any);

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.calendarStatus).toBe('NO_CONNECTION');
		expect(view.eventos).toHaveLength(1);
		expect(view.eventos[0].origem).toBe('domain');
	});

	it('GoogleConnection sem calendarId: status NO_CALENDAR', async () => {
		vi.mocked(resolveUserCalendarQuery).mockResolvedValue({ status: 'NO_CALENDAR' } as any);

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.calendarStatus).toBe('NO_CALENDAR');
		expect(view.eventos).toEqual([]);
	});

	it('evento externo do Calendar entra na agenda e na ocupação', async () => {
		mockAdapterOk([makeGoogleEvent()]);

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.eventos).toHaveLength(1);
		expect(view.eventos[0].origem).toBe('google');
		expect(view.eventos[0].titulo).toBe('Reunião externa');
		expect(view.ocupacao).toHaveLength(1);
		expect(view.disponibilidade).toHaveLength(2);
		expect(view.calendarStatus).toBe('OK');
	});

	it('evento domain com googleEventId é mesclado com o evento do Calendar (sem duplicar)', async () => {
		vi.mocked(eventoRepository.findByDataPeriodo).mockResolvedValue([
			makeEvento({ googleEventId: 'gcal-event-1' }),
		]);
		mockAdapterOk([makeGoogleEvent({ start: '2026-09-10T16:00:00-03:00', end: '2026-09-10T17:00:00-03:00' })]);

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.eventos).toHaveLength(1);
		expect(view.eventos[0].origem).toBe('domain');
		expect(view.eventos[0].googleEventId).toBe('gcal-event-1');
		expect(view.eventos[0].inicio.getTime()).toBe(new Date('2026-09-10T16:00:00-03:00').getTime());
		expect(view.eventos[0].fim.getTime()).toBe(new Date('2026-09-10T17:00:00-03:00').getTime());
		expect(view.ocupacao).toHaveLength(1);
	});

	it('evento domain sem googleEventId permanece na agenda', async () => {
		vi.mocked(eventoRepository.findByDataPeriodo).mockResolvedValue([makeEvento({ googleEventId: undefined })]);
		mockAdapterOk([]);

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.eventos).toHaveLength(1);
		expect(view.eventos[0].origem).toBe('domain');
		expect(view.eventos[0].googleEventId).toBeUndefined();
	});

	it('falha no Google Calendar: status UNAVAILABLE preservando eventos do domínio', async () => {
		vi.mocked(eventoRepository.findByDataPeriodo).mockResolvedValue([makeEvento()]);
		vi.mocked(resolveUserCalendarQuery).mockRejectedValue(new Error('Google API error'));

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.calendarStatus).toBe('UNAVAILABLE');
		expect(view.eventos).toHaveLength(1);
		expect(view.eventos[0].origem).toBe('domain');
	});

	it('falha no adapter após resolução: status UNAVAILABLE', async () => {
		const queryEvents = vi.fn().mockRejectedValue(new Error('quota exceeded'));
		vi.mocked(resolveUserCalendarQuery).mockResolvedValue({ status: 'OK', adapter: { queryEvents } } as any);

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.calendarStatus).toBe('UNAVAILABLE');
		expect(view.eventos).toEqual([]);
	});

	it('evento all-day do Calendar ocupa o dia inteiro', async () => {
		mockAdapterOk([makeGoogleEvent({ start: '', end: '', startDate: '2026-09-10', endDate: '2026-09-11', summary: 'Feriado' })]);

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.eventos).toHaveLength(1);
		expect(view.eventos[0].allDay).toBe(true);
		expect(view.eventos[0].inicio.getTime()).toBe(DE.getTime());
		expect(view.eventos[0].fim.getTime()).toBe(ATE.getTime());
		expect(view.ocupacao).toHaveLength(1);
		expect(view.ocupacao[0].inicio.getTime()).toBe(DE.getTime());
		expect(view.ocupacao[0].fim.getTime()).toBe(ATE.getTime());
		expect(view.disponibilidade).toHaveLength(0);
	});

	it('evento cancelado do Calendar é ignorado', async () => {
		mockAdapterOk([makeGoogleEvent({ status: 'cancelled' })]);

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.eventos).toEqual([]);
		expect(view.disponibilidade).toHaveLength(1);
	});

	it('eventos com offsets de timezone diferentes são comparados por instante', async () => {
		vi.mocked(eventoRepository.findByDataPeriodo).mockResolvedValue([
			makeEvento({ data: new Date('2026-09-10T14:30:00-03:00'), googleEventId: undefined }),
		]);
		mockAdapterOk([
			makeGoogleEvent({ start: '2026-09-10T18:00:00+01:00', end: '2026-09-10T19:00:00+01:00' }),
		]);

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.eventos).toHaveLength(2);
		expect(view.ocupacao).toHaveLength(1);
		expect(view.ocupacao[0].inicio.getTime()).toBe(new Date('2026-09-10T14:00:00-03:00').getTime());
		expect(view.ocupacao[0].fim.getTime()).toBe(new Date('2026-09-10T15:30:00-03:00').getTime());
	});

	it('tipos que não são agenda (VENDA) são excluídos', async () => {
		vi.mocked(eventoRepository.findByDataPeriodo).mockResolvedValue([
			makeEvento({ tipo: 'VENDA' }),
		]);
		mockAdapterOk([]);

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.eventos).toEqual([]);
	});

	it('evento domain iniciado antes do período é incluído e recortado', async () => {
		vi.mocked(eventoRepository.findByDataPeriodo).mockResolvedValue([
			makeEvento({ data: new Date('2026-09-09T23:30:00-03:00'), googleEventId: undefined }),
		]);
		mockAdapterOk([]);

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.eventos).toHaveLength(1);
		expect(view.eventos[0].inicio.getTime()).toBe(new Date('2026-09-09T23:30:00-03:00').getTime());
		expect(view.ocupacao).toHaveLength(1);
		expect(view.ocupacao[0].inicio.getTime()).toBe(DE.getTime());
		expect(view.ocupacao[0].fim.getTime()).toBe(new Date('2026-09-10T00:30:00-03:00').getTime());
	});

	it('anexa leadNome quando o lead existe; usa fallback quando não existe', async () => {
		vi.mocked(eventoRepository.findByDataPeriodo).mockResolvedValue([
			makeEvento({ leadId: 'lead-existente' }),
			makeEvento({ id: 'evento-2', leadId: 'lead-excluido', data: new Date('2026-09-10T16:00:00-03:00') }),
		]);
		vi.mocked(leadRepository.findById).mockImplementation(async (_userId: string, id: string) =>
			id === 'lead-existente' ? ({ id, nome: 'Maria' } as any) : null,
		);
		mockAdapterOk([]);

		const view = await consultarAgenda('507f1f77bcf86cd799439011', DE, ATE);

		expect(view.eventos).toHaveLength(2);
		expect(view.eventos[0].leadNome).toBe('Maria');
		expect(view.eventos[0].titulo).toBe('Maria');
		expect(view.eventos[1].leadNome).toBeUndefined();
		expect(view.eventos[1].titulo).toBe('AGENDAMENTO');
	});
});
