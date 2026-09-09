import type { Lead } from './lead.js';

export const EVENTO_TIPOS = ['AGENDAMENTO', 'VENDA', 'DESISTENCIA', 'REAGENDAMENTO', 'NO_SHOW'] as const;

export type EventoTipo = (typeof EVENTO_TIPOS)[number];

export interface Evento {
	id: string;
	userId: string;
	leadId: string;
	tipo: EventoTipo;
	data: Date;
	observacoes?: string;
	previousEventoId?: string;
	googleEventId?: string;
	createdAt: Date;
}

export interface CreateEventoInput {
	leadId: string;
	tipo: EventoTipo;
	data?: Date;
	observacoes?: string;
	userId: string;
	// Explicit correction target (panel use). Validated: same tenant + lead,
	// active (AGENDAMENTO/REAGENDAMENTO, not superseded). When absent, the
	// predecessor is auto-resolved (last active) as in the chat flow.
	eventoId?: string;
}

export interface Periodo {
	de: Date;
	ate: Date;
}

export interface LeadsPorStatus {
	status: NonNullable<Lead['status']> | 'SEM_STATUS';
	total: number;
}

export interface EventosPorTipo {
	tipo: EventoTipo;
	total: number;
}

export interface TaxaConversao {
	totalLeads: number;
	vendidos: number;
	taxaConversao: number;
}

export interface MetricasPeriodo {
	eventosPorTipo: EventosPorTipo[];
	taxaConversao: TaxaConversao;
}
