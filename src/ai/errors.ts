export interface MissingParameters {
	type: 'MISSING_PARAMETERS';
	missing: string[];
	message: string;
}

export interface AmbiguousEntity {
	type: 'AMBIGUOUS_ENTITY';
	candidates: Array<{ id: string; nome: string; telefone: string }>;
	message: string;
}

export interface EntityNotFound {
	type: 'ENTITY_NOT_FOUND';
	message: string;
}

export interface InvalidIntent {
	type: 'INVALID_INTENT';
	message: string;
}

export interface LLMError {
	type: 'LLM_ERROR';
	message: string;
}

export interface ServiceError {
	type: 'SERVICE_ERROR';
	message: string;
}

export interface InfrastructureError {
	type: 'INFRASTRUCTURE_ERROR';
	message: string;
}

export interface InvalidDate {
	type: 'INVALID_DATE';
	message: string;
	field?: string;
}

export interface PastDate {
	type: 'PAST_DATE';
	message: string;
}

export interface InvalidTime {
	type: 'INVALID_TIME';
	message: string;
	time: string;
}

export type OrchestratorResult =
	| MissingParameters
	| AmbiguousEntity
	| EntityNotFound
	| InvalidIntent
	| LLMError
	| ServiceError
	| InfrastructureError
	| InvalidDate
	| PastDate
	| InvalidTime
	| { type: 'SUCCESS'; message: string; data?: unknown };
