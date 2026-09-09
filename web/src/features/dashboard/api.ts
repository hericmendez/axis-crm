import { apiGet } from '../../lib/api-client.js';
import type { Metricas } from '../../types/api.js';

export function fetchMetricas(de: Date, ate: Date): Promise<Metricas> {
	const params = new URLSearchParams({ de: de.toISOString(), ate: ate.toISOString() });
	return apiGet<Metricas>(`/api/metricas?${params.toString()}`);
}

export function defaultPeriodo(): { de: Date; ate: Date } {
	const ate = new Date();
	const de = new Date(ate.getTime() - 30 * 24 * 60 * 60 * 1000);
	return { de, ate };
}
