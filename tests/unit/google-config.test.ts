import { describe, expect, it } from 'vitest';
import { isGoogleConfigured, normalizePrivateKey } from '../../src/integrations/google/google.types.js';

describe('Google config helpers', () => {
	describe('isGoogleConfigured', () => {
		it('returns false when no config provided', () => {
			expect(isGoogleConfigured({})).toBe(false);
		});

		it('returns false when only clientEmail is provided', () => {
			expect(isGoogleConfigured({ GOOGLE_CLIENT_EMAIL: 'test@sa.iam' })).toBe(false);
		});

		it('returns false when only privateKey is provided', () => {
			expect(isGoogleConfigured({ GOOGLE_PRIVATE_KEY: 'key' })).toBe(false);
		});

		it('returns true when both clientEmail and privateKey are provided', () => {
			expect(
				isGoogleConfigured({
					GOOGLE_CLIENT_EMAIL: 'test@sa.iam',
					GOOGLE_PRIVATE_KEY: 'key',
				}),
			).toBe(true);
		});

		it('returns false when clientEmail is empty string', () => {
			expect(isGoogleConfigured({ GOOGLE_CLIENT_EMAIL: '', GOOGLE_PRIVATE_KEY: 'key' })).toBe(false);
		});
	});

	describe('normalizePrivateKey', () => {
		it('replaces \\n with actual newlines', () => {
			const raw = '-----BEGIN RSA PRIVATE KEY-----\\nMIIE...\\n-----END RSA PRIVATE KEY-----';
			const normalized = normalizePrivateKey(raw);
			expect(normalized).toContain('\n');
			expect(normalized).not.toContain('\\n');
		});

		it('replaces \\r\\n with \\n', () => {
			const raw = 'line1\r\nline2';
			const normalized = normalizePrivateKey(raw);
			expect(normalized).toBe('line1\nline2');
		});

		it('preserves already correct newlines', () => {
			const raw = 'line1\nline2';
			const normalized = normalizePrivateKey(raw);
			expect(normalized).toBe('line1\nline2');
		});
	});
});
