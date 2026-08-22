import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors.js';

interface Bucket {
	count: number;
	resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const buckets = new Map<string, Bucket>();

export function rateLimit(req: Request, _res: Response, next: NextFunction): void {
	const key = req.ip ?? 'unknown';
	const now = Date.now();

	let bucket = buckets.get(key);
	if (!bucket || bucket.resetAt <= now) {
		bucket = { count: 0, resetAt: now + WINDOW_MS };
		buckets.set(key, bucket);
	}

	bucket.count += 1;
	if (bucket.count > MAX_REQUESTS) {
		next(new AppError(429, 'Muitas requisições'));
		return;
	}
	next();
}
