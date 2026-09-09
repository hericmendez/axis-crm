import { describe, expect, it } from 'vitest';
import { comparePassword, hashPassword } from '../../src/auth/password.js';

describe('password hashing', () => {
	it('gera hash diferente do plaintext', async () => {
		const hash = await hashPassword('senha-secreta-123');
		expect(hash).not.toBe('senha-secreta-123');
		expect(hash).toMatch(/^\$2[aby]\$/);
	});

	it('senha correta valida', async () => {
		const hash = await hashPassword('senha-secreta-123');
		await expect(comparePassword('senha-secreta-123', hash)).resolves.toBe(true);
	});

	it('senha incorreta falha', async () => {
		const hash = await hashPassword('senha-secreta-123');
		await expect(comparePassword('outra-senha', hash)).resolves.toBe(false);
	});

	it('hashes da mesma senha diferem (salt)', async () => {
		const a = await hashPassword('mesma-senha');
		const b = await hashPassword('mesma-senha');
		expect(a).not.toBe(b);
	});
});
