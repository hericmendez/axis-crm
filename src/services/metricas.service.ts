import type { EventosPorTipo, LeadsPorStatus, Periodo, TaxaConversao } from '../types/evento.js';
import type { AgendaItem } from '../types/agenda.js';
import type { Lead } from '../types/lead.js';
import * as leadRepository from '../repositories/lead.repository.js';
import * as eventoService from './evento.service.js';

export async function leadsPorStatus(): Promise<LeadsPorStatus[]> {
	return leadRepository.countByStatus();
}

export async function eventosPorTipo(periodo: Periodo): Promise<EventosPorTipo[]> {
	return eventoService.countByTipoInPeriod(periodo);
}

export async function taxaConversao(): Promise<TaxaConversao> {
	const [porStatus] = await Promise.all([leadsPorStatus()]);
	const totalLeads = porStatus.reduce((acc, s) => acc + s.total, 0);
	const vendidos = porStatus.find((s) => s.status === 'VENDIDO')?.total ?? 0;
	return {
		totalLeads,
		vendidos,
		taxaConversao: totalLeads === 0 ? 0 : vendidos / totalLeads,
	};
}

function toAgendaItem(lead: Lead): AgendaItem {
	return {
		leadId: lead.id,
		nome: lead.nome,
		telefone: lead.telefone,
		status: lead.status,
		dataAgendamento: lead.dataAgendamento as Date,
	};
}

export async function agenda(de: Date, ate: Date): Promise<AgendaItem[]> {
	const leads = await leadRepository.findByAgendamentoPeriodo(de, ate);
	return leads.map(toAgendaItem);
}
