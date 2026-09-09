import { AppError } from '../utils/errors.js';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// Every service method that touches persisted domain data requires an explicit,
// authenticated tenant. Missing or malformed identity fails closed (401) —
// repositories additionally constrain every query by userId as defense in depth.
export function requireTenant(userId: string | undefined): string {
	if (!userId || !OBJECT_ID_RE.test(userId)) {
		throw new AppError(401, 'Autenticação necessária');
	}
	return userId;
}
