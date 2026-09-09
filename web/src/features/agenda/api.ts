import { apiGet, apiRequest } from '../../lib/api-client.js';
import type { AgendaView, Evento, EventoTipo } from '../../types/api.js';

export interface AgendaRange {
	de?: string;
	ate?: string;
}

export function fetchAgenda(range: AgendaRange = {}): Promise<AgendaView> {
	const params = new URLSearchParams();
	if (range.de) params.set('de', range.de);
	if (range.ate) params.set('ate', range.ate);
	const query = params.toString();
	return apiGet<AgendaView>(`/api/v1/agenda${query ? `?${query}` : ''}`);
}

export interface EventoCreateInput {
	leadId: string;
	tipo: EventoTipo;
	data?: string;
	observacoes?: string;
	eventoId?: string;
}

export function createEvento(input: EventoCreateInput): Promise<Evento> {
	return apiRequest<Evento>(`/api/leads/${input.leadId}/eventos`, {
		method: 'POST',
		body: {
			tipo: input.tipo,
			...(input.data ? { data: input.data } : {}),
			...(input.observacoes ? { observacoes: input.observacoes } : {}),
			...(input.eventoId ? { eventoId: input.eventoId } : {}),
		},
	});
}

export function toDatetimeLocalValue(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toDateInputValue(date: Date): string {
	return toDatetimeLocalValue(date).slice(0, 10);
}

export function formatDateTime(value: string): string {
	return new Date(value).toLocaleString('pt-BR', {
		timeZone: 'America/Sao_Paulo',
		day: '2-digit',
		month: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}
