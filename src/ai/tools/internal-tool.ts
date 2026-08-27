import type { OrchestratorResult } from '../errors.js';

export interface InternalTool<P = Record<string, unknown>> {
	execute(params: P): Promise<OrchestratorResult>;
}
