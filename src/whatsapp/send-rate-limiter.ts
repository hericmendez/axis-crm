const MIN_INTERVAL_MS = 3_000;

let lastSentAt = 0;

export function canSendNow(now = Date.now()): boolean {
	if (now - lastSentAt < MIN_INTERVAL_MS) return false;
	return true;
}

export function markSent(now = Date.now()): void {
	lastSentAt = now;
}

/** Reseta o estado do limitador (uso em testes). */
export function resetRateLimit(): void {
	lastSentAt = 0;
}
