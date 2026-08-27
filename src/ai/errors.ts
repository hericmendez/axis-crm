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

export type OrchestratorResult =
	| MissingParameters
	| AmbiguousEntity
	| EntityNotFound
	| InvalidIntent
	| LLMError
	| ServiceError
	| InfrastructureError
	| { type: 'SUCCESS'; message: string; data?: unknown };
