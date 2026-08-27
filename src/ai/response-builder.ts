import type { OrchestratorResult } from './errors.js';

export function buildResponse(result: OrchestratorResult): string {
	switch (result.type) {
		case 'SUCCESS':
			return result.message;
		case 'MISSING_PARAMETERS':
			return `Para isso, preciso de mais informações: ${result.missing.join(', ')}.`;
		case 'AMBIGUOUS_ENTITY':
			return result.message;
		case 'ENTITY_NOT_FOUND':
			return 'Não encontrei o lead solicitado. Pode verificar o nome ou telefone?';
		case 'INVALID_INTENT':
			return 'Desculpe, não consegui entender essa solicitação.';
		case 'LLM_ERROR':
			return 'Estou com dificuldade para processar sua mensagem. Tente novamente em instantes.';
		case 'SERVICE_ERROR':
			return 'Ocorreu um erro ao processar sua solicitação. Tente novamente.';
		case 'INFRASTRUCTURE_ERROR':
			return 'Estou com problemas técnicos no momento. Tente novamente mais tarde.';
	}
}
