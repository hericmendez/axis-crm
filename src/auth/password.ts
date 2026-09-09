import bcrypt from 'bcryptjs';
import { getEnv } from '../config/env.js';

// bcrypt (cost configurable) — pure-JS dependency, no native toolchain required.
// Passwords are never stored or logged in plaintext; only hashes leave this module.
export async function hashPassword(password: string): Promise<string> {
	const { BCRYPT_ROUNDS } = getEnv();
	return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, passwordHash: string): Promise<boolean> {
	return bcrypt.compare(password, passwordHash);
}
