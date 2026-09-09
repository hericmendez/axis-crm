import { apiGet, apiRequest } from '../../lib/api-client.js';
import type { Evento, Lead, LeadStatus, PaginatedResult } from '../../types/api.js';

export interface LeadFilters {
	status?: LeadStatus;
	telefone?: string;
	nome?: string;
	page?: number;
	limit?: number;
}

export interface LeadCreateInput {
	nome: string;
	telefone: string;
	contatoOrigem: string;
	email?: string;
	senioridade?: string;
	renda?: number;
	status?: LeadStatus;
	observacoes?: string;
}

export type LeadUpdateInput = Partial<
	Omit<LeadCreateInput, 'telefone' | 'contatoOrigem'>
> & { contatoOrigem?: string };

function queryString(params: Record<string, string | number | undefined>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== '') search.set(key, String(value));
	}
	const text = search.toString();
	return text ? `?${text}` : '';
}

export function fetchLeads(filters: LeadFilters = {}): Promise<PaginatedResult<Lead>> {
	return apiGet<PaginatedResult<Lead>>(
		`/api/leads${queryString({ ...filters })}`,
	);
}

export function fetchLead(id: string): Promise<Lead> {
	return apiGet<Lead>(`/api/leads/${id}`);
}

export function createLead(input: LeadCreateInput): Promise<Lead> {
	const renda = input.renda;
	return apiRequest<Lead>('/api/leads', {
		method: 'POST',
		body: {
			...input,
			...(renda === undefined || Number.isNaN(renda) ? {} : { renda }),
		},
	});
}

export function updateLead(id: string, patch: LeadUpdateInput): Promise<Lead> {
	return apiRequest<Lead>(`/api/leads/${id}`, { method: 'PATCH', body: patch });
}

export function deleteLead(id: string): Promise<void> {
	return apiRequest<void>(`/api/leads/${id}`, { method: 'DELETE' });
}

export function fetchLeadEventos(leadId: string): Promise<Evento[]> {
	return apiGet<Evento[]>(`/api/leads/${leadId}/eventos`);
}
