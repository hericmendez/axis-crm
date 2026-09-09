import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/env.js', () => ({
	getEnv: () => ({}),
	loadEnv: () => ({}),
}));

import { signAccessToken } from '../../src/auth/tokens.js';

describe('access JWT sem secret configurado', () => {
	it('falha fechado em vez de usar fallback', () => {
		expect(() => signAccessToken('user-1')).toThrowError(/não configurado/);
	});
});
