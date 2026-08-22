import type { Lead } from './lead.js';

export const EVENTO_TIPOS = ['AGENDAMENTO', 'VENDA', 'DESISTENCIA', 'REAGENDAMENTO', 'NO_SHOW'] as const;

export type EventoTipo = (typeof EVENTO_TIPOS)[number];

export interface Evento {
	id: string;
	leadId: string;
	tipo: EventoTipo;
	data: Date;
	observacoes?: string;
	createdAt: Date;
}

export interface CreateEventoInput {
	leadId: string;
	tipo: EventoTipo;
	data?: Date;
	observacoes?: string;
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
