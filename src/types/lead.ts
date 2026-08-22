export const LEAD_STATUS = ['AGENDADO', 'VENDIDO', 'PERDIDO', 'NO_SHOW', 'REAGENDADO'] as const;

export type LeadStatus = (typeof LEAD_STATUS)[number];

export interface Lead {
	id: string;
	nome: string;
	telefone: string;
	email?: string;
	contatoOrigem: string;
	senioridade?: string;
	renda?: number;
	status?: LeadStatus;
	dataAgendamento?: Date;
	dataConversao?: Date;
	tipoFechamento?: string;
	observacoes?: string;
	ultimaInteracao?: Date;
	createdAt: Date;
	updatedAt: Date;
}

export type CreateLeadInput = Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>;

export type UpdateLeadInput = Partial<Omit<CreateLeadInput, 'telefone'>>;

export interface PaginationParams {
	page: number;
	limit: number;
}

export interface PaginatedResult<T> {
	items: T[];
	total: number;
	page: number;
	limit: number;
}
