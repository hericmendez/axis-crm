import type { Lead } from './lead.js';
import type { EventoTipo } from './evento.js';

export interface AgendaItem {
	leadId: string;
	nome: string;
	telefone: string;
	status?: Lead['status'];
	dataAgendamento: Date;
}

export type AgendaOrigem = 'domain' | 'google';

export interface AgendaEventoView {
	id: string;
	origem: AgendaOrigem;
	titulo: string;
	inicio: Date;
	fim: Date;
	allDay: boolean;
	tipo?: EventoTipo;
	leadId?: string;
	leadNome?: string;
	googleEventId?: string;
}

export interface Intervalo {
	inicio: Date;
	fim: Date;
}

export type CalendarStatus = 'OK' | 'NO_CONNECTION' | 'NO_CALENDAR' | 'UNAVAILABLE';

export interface AgendaView {
	de: Date;
	ate: Date;
	eventos: AgendaEventoView[];
	ocupacao: Intervalo[];
	disponibilidade: Intervalo[];
	calendarStatus: CalendarStatus;
}
