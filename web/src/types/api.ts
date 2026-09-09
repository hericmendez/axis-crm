// HTTP contract types. Manually mirrors docs/api/openapi.yaml, which stays
// authoritative — see web/docs/ARCHITECTURE.md for why generation was deferred.
// These describe JSON over HTTP only (never Mongoose documents or backend internals).

export interface ApiErrorBody {
	error: string;
}

export type ObjectId = string;

export type LeadStatus = 'AGENDADO' | 'VENDIDO' | 'PERDIDO' | 'NO_SHOW' | 'REAGENDADO';

export interface Lead {
	id: ObjectId;
	userId: ObjectId;
	nome: string;
	telefone: string;
	email?: string;
	contatoOrigem: string;
	senioridade?: string;
	renda?: number;
	status?: LeadStatus;
	dataAgendamento?: string;
	dataConversao?: string;
	tipoFechamento?: string;
	observacoes?: string;
	ultimaInteracao?: string;
	createdAt: string;
	updatedAt: string;
}

export interface PaginatedResult<T> {
	items: T[];
	total: number;
	page: number;
	limit: number;
}

export type EventoTipo = 'AGENDAMENTO' | 'VENDA' | 'DESISTENCIA' | 'REAGENDAMENTO' | 'NO_SHOW';

export interface Evento {
	id: ObjectId;
	userId: ObjectId;
	leadId: ObjectId;
	tipo: EventoTipo;
	data: string;
	observacoes?: string;
	previousEventoId?: string;
	googleEventId?: string;
	createdAt: string;
}

export type ConversaCanal = 'whatsapp';

export type MensagemPapel = 'usuario' | 'axis';

export interface MensagemConversa {
	id: string;
	papel: MensagemPapel;
	conteudo: string;
	criadoEm: string;
}

export interface Conversa {
	id: ObjectId;
	userId: ObjectId;
	canal: ConversaCanal;
	chatIdExterno: string;
	leadId?: string;
	mensagens: MensagemConversa[];
	summary?: string;
	summaryUpdatedAt?: string;
	summaryMessageCount?: number;
	createdAt: string;
	updatedAt: string;
}

export type AgendaOrigem = 'domain' | 'google';

export interface AgendaEventoView {
	id: string;
	origem: AgendaOrigem;
	titulo: string;
	inicio: string;
	fim: string;
	allDay: boolean;
	tipo?: EventoTipo;
	leadId?: string;
	leadNome?: string;
	googleEventId?: string;
}

export interface Intervalo {
	inicio: string;
	fim: string;
}

export type CalendarStatus = 'OK' | 'NO_CONNECTION' | 'NO_CALENDAR' | 'UNAVAILABLE';

export interface AgendaView {
	de: string;
	ate: string;
	eventos: AgendaEventoView[];
	ocupacao: Intervalo[];
	disponibilidade: Intervalo[];
	calendarStatus: CalendarStatus;
}

export interface AuthUser {
	id: ObjectId;
	email: string;
	name: string;
}

export interface AuthResponse {
	accessToken: string;
	refreshToken: string;
	user: AuthUser;
}

export type GoogleStatus =
	| { connected: false }
	| {
			connected: true;
			email: string;
			calendarConfigured: boolean;
			spreadsheetConfigured: boolean;
			createdAt: string;
	  };

export type WhatsAppStatusValue = 'desconectado' | 'aguardando_qr' | 'conectando' | 'conectado';

export interface WhatsAppStatus {
	status: WhatsAppStatusValue;
	connected: boolean;
}

export interface WhatsAppQr {
	qr: string;
}

export interface LeadsPorStatus {
	status: string;
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

export interface Metricas {
	leadsPorStatus: LeadsPorStatus[];
	eventosPorTipo: EventosPorTipo[];
	taxaConversao: TaxaConversao;
}
