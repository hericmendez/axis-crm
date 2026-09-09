import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';
import { getEnv } from '../config/env.js';

interface Bucket {
	count: number;
	resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Brute-force protection for the public auth endpoints (login + refresh).
// Keyed by IP and, when present, the normalized login email — so guessing
// against one account from many IPs (and one IP against many accounts) both
// stay bounded, while unrelated test/dev traffic is unaffected.
// Limits come from env (AUTH_LOGIN_WINDOW_MS / AUTH_LOGIN_MAX) so tests can
// raise them deterministically without touching production defaults.
export function authRateLimit(req: Request, _res: Response, next: NextFunction): void {
	const { AUTH_LOGIN_WINDOW_MS, AUTH_LOGIN_MAX } = getEnv();
	const now = Date.now();

	const rawEmail = (req.body as { email?: unknown } | undefined)?.email;
	const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
	const key = `${req.ip ?? 'unknown'}|${email}`;

	let bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		bucket = { count: 0, resetAt: now + AUTH_LOGIN_WINDOW_MS };
		buckets.set(key, bucket);
	}

	bucket.count += 1;
	if (bucket.count > AUTH_LOGIN_MAX) {
		next(new AppError(429, 'Muitas tentativas, tente novamente mais tarde'));
		return;
	}
	next();
}
