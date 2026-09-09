import { apiGet } from '../../lib/api-client.js';
import type { Conversa, ConversaCanal, PaginatedResult } from '../../types/api.js';

export interface ConversaFilters {
	leadId?: string;
	canal?: ConversaCanal;
	chatIdExterno?: string;
	page?: number;
	limit?: number;
}

export function fetchConversas(filters: ConversaFilters = {}): Promise<PaginatedResult<Conversa>> {
	const params = new URLSearchParams();
	if (filters.leadId) params.set('leadId', filters.leadId);
	if (filters.canal) params.set('canal', filters.canal);
	if (filters.chatIdExterno) params.set('chatIdExterno', filters.chatIdExterno);
	if (filters.page !== undefined) params.set('page', String(filters.page));
	if (filters.limit !== undefined) params.set('limit', String(filters.limit));
	const query = params.toString();
	return apiGet<PaginatedResult<Conversa>>(`/api/v1/conversations${query ? `?${query}` : ''}`);
}

export function fetchConversa(id: string, limit = 50): Promise<Conversa> {
	return apiGet<Conversa>(`/api/v1/conversations/${id}?limit=${limit}`);
}
