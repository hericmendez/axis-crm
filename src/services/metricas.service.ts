import type { EventosPorTipo, LeadsPorStatus, Periodo, TaxaConversao } from '../types/evento.js';
import type { AgendaItem } from '../types/agenda.js';
import type { Lead } from '../types/lead.js';
import * as leadRepository from '../repositories/lead.repository.js';
import * as eventoService from './evento.service.js';
import { requireTenant } from './tenant.js';

export async function leadsPorStatus(userId: string | undefined): Promise<LeadsPorStatus[]> {
	const tenant = requireTenant(userId);
	return leadRepository.countByStatus(tenant);
}

export async function eventosPorTipo(userId: string | undefined, periodo: Periodo): Promise<EventosPorTipo[]> {
	const tenant = requireTenant(userId);
	return eventoService.countByTipoInPeriod(tenant, periodo);
}

export async function taxaConversao(userId: string | undefined): Promise<TaxaConversao> {
	const [porStatus] = await Promise.all([leadsPorStatus(userId)]);
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

export async function agenda(userId: string | undefined, de: Date, ate: Date): Promise<AgendaItem[]> {
	const tenant = requireTenant(userId);
	const leads = await leadRepository.findByAgendamentoPeriodo(tenant, de, ate);
	return leads.map(toAgendaItem);
}
