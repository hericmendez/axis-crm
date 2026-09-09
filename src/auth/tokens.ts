import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors.js';
import { getEnv } from '../config/env.js';

const ALGORITHM = 'HS256';

export interface AccessTokenClaims {
	sub: string;
	iat: number;
	exp: number;
}

function requireSecret(): string {
	const { JWT_ACCESS_SECRET } = getEnv();
	if (!JWT_ACCESS_SECRET) {
		throw new AppError(500, 'Autenticação indisponível: JWT_ACCESS_SECRET não configurado');
	}
	return JWT_ACCESS_SECRET;
}

export function signAccessToken(userId: string): string {
	const { JWT_ACCESS_EXPIRES_IN } = getEnv();
	return jwt.sign({ sub: userId }, requireSecret(), {
		algorithm: ALGORITHM,
		expiresIn: JWT_ACCESS_EXPIRES_IN as `${number}${'s' | 'm' | 'h' | 'd'}`,
	});
}

export function verifyAccessToken(token: string): AccessTokenClaims {
	let decoded: unknown;
	try {
		decoded = jwt.verify(token, requireSecret(), { algorithms: [ALGORITHM] });
	} catch {
		throw new AppError(401, 'Token inválido ou expirado');
	}
	if (
		typeof decoded !== 'object' ||
		decoded === null ||
		typeof (decoded as { sub?: unknown }).sub !== 'string' ||
		!(decoded as { sub: string }).sub
	) {
		throw new AppError(401, 'Token inválido ou expirado');
	}
	return decoded as AccessTokenClaims;
}
