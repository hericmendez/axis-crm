import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiBaseUrl } from './env.js';

describe('getApiBaseUrl', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('defaults to same-origin when unconfigured', () => {
		vi.stubEnv('VITE_API_URL', '');
		expect(getApiBaseUrl()).toBe('');
	});

	it('trims and strips trailing slashes', () => {
		vi.stubEnv('VITE_API_URL', '  https://api.example.com/  ');
		expect(getApiBaseUrl()).toBe('https://api.example.com');
	});
});
