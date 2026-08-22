const MIN_INTERVAL_MS = 3_000;

let lastSentAt = 0;

/**
 * Reserva atomicamente um slot de envio.
 * Retorna a função de liberação (restaura o estado anterior, permitindo novo
 * envio imediato após falha) ou null se bloqueado pelo intervalo mínimo.
 */
export function tryAcquire(now = Date.now()): (() => void) | null {
	if (now - lastSentAt < MIN_INTERVAL_MS) return null;
	const previous = lastSentAt;
	lastSentAt = now;
	return () => {
		lastSentAt = previous;
	};
}

/** Reseta o estado do limitador (uso em testes). */
export function resetRateLimit(): void {
	lastSentAt = 0;
}
