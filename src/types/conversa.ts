export const CONVERSA_CANAIS = ['whatsapp'] as const;

export type ConversaCanal = (typeof CONVERSA_CANAIS)[number];

export const MENSAGEM_PAPES = ['usuario', 'axis'] as const;

export type MensagemPapel = (typeof MENSAGEM_PAPES)[number];

export interface MensagemConversa {
	id: string;
	papel: MensagemPapel;
	conteudo: string;
	criadoEm: Date;
}

export interface ConversationContext {
	summary?: string;
	recentMessages: MensagemConversa[];
}

export interface Conversa {
	id: string;
	canal: ConversaCanal;
	chatIdExterno: string;
	leadId?: string;
	mensagens: MensagemConversa[];
	summary?: string;
	summaryUpdatedAt?: Date;
	summaryMessageCount?: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateConversaInput {
	canal: ConversaCanal;
	chatIdExterno: string;
}

export interface AppendMensagemInput {
	papel: MensagemPapel;
	conteudo: string;
}
