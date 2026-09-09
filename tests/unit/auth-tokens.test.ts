import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken } from '../../src/auth/tokens.js';

const SECRET = process.env.JWT_ACCESS_SECRET as string;

describe('access JWT', () => {
	it('token válido verifica e expõe sub', () => {
		const token = signAccessToken('user-1');
		const claims = verifyAccessToken(token);
		expect(claims.sub).toBe('user-1');
		expect(claims.exp).toBeGreaterThan(claims.iat);
	});

	it('token expirado é rejeitado', () => {
		const expired = jwt.sign({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, {
			algorithm: 'HS256',
		});
		expect(() => verifyAccessToken(expired)).toThrowError(/inválido ou expirado/);
	});

	it('assinatura inválida é rejeitada', () => {
		const forged = jwt.sign({ sub: 'user-1' }, 'outro-secret', {
			algorithm: 'HS256',
			expiresIn: '15m',
		});
		expect(() => verifyAccessToken(forged)).toThrowError(/inválido ou expirado/);
	});

	it('algoritmo fora da allowlist é rejeitado', () => {
		const other = jwt.sign({ sub: 'user-1' }, SECRET, {
			algorithm: 'HS384',
			expiresIn: '15m',
		});
		expect(() => verifyAccessToken(other)).toThrowError(/inválido ou expirado/);
	});

	it('payload sem identidade é rejeitado', () => {
		const noSub = jwt.sign({ role: 'admin' }, SECRET, { algorithm: 'HS256', expiresIn: '15m' });
		expect(() => verifyAccessToken(noSub)).toThrowError(/inválido ou expirado/);
	});

	it('lixo não-JWT é rejeitado', () => {
		expect(() => verifyAccessToken('not-a-token')).toThrowError(/inválido ou expirado/);
	});

	it('token alg:none não assinado é rejeitado', () => {
		const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
		const payload = Buffer.from(
			JSON.stringify({ sub: '507f1f77bcf86cd799439011' }),
		).toString('base64url');
		expect(() => verifyAccessToken(`${header}.${payload}.`)).toThrowError(/inválido ou expirado/);
	});
});
