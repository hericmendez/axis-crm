import { createHash, randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getEnv } from '../config/env.js';
import { UserModel } from '../models/user.model.js';
import { RefreshTokenModel } from '../models/refresh-token.model.js';
import { comparePassword, hashPassword } from '../auth/password.js';
import { signAccessToken } from '../auth/tokens.js';

// Dummy hash used when the email is unknown so unknown-email and wrong-password
// logins cost the same bcrypt comparison (no user-enumeration via timing).
const DUMMY_HASH = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jAFP9x';

export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
}

export interface AuthUser {
	id: string;
	email: string;
	name: string;
}

export interface LoginResult extends AuthTokens {
	user: AuthUser;
}

function hashRefreshToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

function newRefreshToken(): string {
	return randomBytes(32).toString('base64url');
}

function refreshExpiry(): Date {
	const { JWT_REFRESH_TTL_DAYS } = getEnv();
	return new Date(Date.now() + JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function issueSession(userId: string): Promise<AuthTokens & { sessionId: string }> {
	const refreshToken = newRefreshToken();
	const created = await RefreshTokenModel.create({
		userId,
		tokenHash: hashRefreshToken(refreshToken),
		expiresAt: refreshExpiry(),
	});
	return { accessToken: signAccessToken(userId), refreshToken, sessionId: String(created._id) };
}

export async function createUserWithPassword(input: {
	name: string;
	email: string;
	password: string;
}): Promise<AuthUser> {
	const existing = await UserModel.findOne({ email: input.email }).select('_id').lean();
	if (existing) {
		throw new AppError(409, 'Email já cadastrado');
	}
	const doc = await UserModel.create({
		name: input.name,
		email: input.email,
		passwordHash: await hashPassword(input.password),
	});
	return { id: String(doc._id), email: input.email, name: input.name };
}

export async function login(email: string, password: string): Promise<LoginResult> {
	const user = await UserModel.findOne({ email }).select('+passwordHash').lean();
	if (!user || !user.passwordHash) {
		await comparePassword(password, DUMMY_HASH);
		throw new AppError(401, 'Credenciais inválidas');
	}
	const ok = await comparePassword(password, user.passwordHash as string);
	if (!ok) {
		throw new AppError(401, 'Credenciais inválidas');
	}
	const tokens = await issueSession(String(user._id));
	logger.info({ userId: String(user._id) }, 'Login realizado');
	return {
		accessToken: tokens.accessToken,
		refreshToken: tokens.refreshToken,
		user: {
			id: String(user._id),
			email: (user.email as string) ?? email,
			name: (user.name as string) ?? '',
		},
	};
}

export async function refresh(refreshToken: string): Promise<LoginResult> {
	const session = await RefreshTokenModel.findOne({ tokenHash: hashRefreshToken(refreshToken) });
	if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
		throw new AppError(401, 'Refresh token inválido ou expirado');
	}
	const user = await UserModel.findById(session.userId).lean();
	if (!user) {
		throw new AppError(401, 'Refresh token inválido ou expirado');
	}
	const tokens = await issueSession(String(user._id));
	session.revokedAt = new Date();
	session.replacedBy = new Types.ObjectId(tokens.sessionId);
	await session.save();
	return {
		accessToken: tokens.accessToken,
		refreshToken: tokens.refreshToken,
		user: {
			id: String(user._id),
			email: (user.email as string) ?? '',
			name: (user.name as string) ?? '',
		},
	};
}

export async function logout(refreshToken: string): Promise<void> {
	const session = await RefreshTokenModel.findOne({ tokenHash: hashRefreshToken(refreshToken) });
	if (!session || session.revokedAt) {
		return;
	}
	session.revokedAt = new Date();
	await session.save();
}
