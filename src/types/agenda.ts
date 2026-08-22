import type { Lead } from './lead.js';

export interface AgendaItem {
	leadId: string;
	nome: string;
	telefone: string;
	status?: Lead['status'];
	dataAgendamento: Date;
}
