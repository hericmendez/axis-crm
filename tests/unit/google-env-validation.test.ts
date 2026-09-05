import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const BASE_ENV = {
	MONGO_URI: 'mongodb://localhost:27017/test',
};

describe('Google env config validation', () => {
	it('accepts when no Google config is provided', () => {
		const env = loadEnv({ ...BASE_ENV });
		expect(env.GOOGLE_CLIENT_EMAIL).toBeUndefined();
		expect(env.GOOGLE_PRIVATE_KEY).toBeUndefined();
	});

	it('accepts when both GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY are provided', () => {
		const env = loadEnv({
			...BASE_ENV,
			GOOGLE_CLIENT_EMAIL: 'test@sa.iam.gserviceaccount.com',
			GOOGLE_PRIVATE_KEY: 'key',
			GOOGLE_CALENDAR_ID: 'calendar-id',
		});
		expect(env.GOOGLE_CLIENT_EMAIL).toBe('test@sa.iam.gserviceaccount.com');
		expect(env.GOOGLE_CALENDAR_ID).toBe('calendar-id');
	});

	it('rejects when GOOGLE_CALENDAR_ID is set without GOOGLE_CLIENT_EMAIL', () => {
		expect(() =>
			loadEnv({
				...BASE_ENV,
				GOOGLE_CALENDAR_ID: 'calendar-id',
			}),
		).toThrow('GOOGLE_CLIENT_EMAIL');
	});

	it('rejects when GOOGLE_CLIENT_EMAIL is set without GOOGLE_PRIVATE_KEY', () => {
		expect(() =>
			loadEnv({
				...BASE_ENV,
				GOOGLE_CLIENT_EMAIL: 'test@sa.iam.gserviceaccount.com',
			}),
		).toThrow('GOOGLE_CLIENT_EMAIL');
	});

	it('rejects when GOOGLE_SHEETS_SPREADSHEET_ID is set without GOOGLE_PRIVATE_KEY', () => {
		expect(() =>
			loadEnv({
				...BASE_ENV,
				GOOGLE_SHEETS_SPREADSHEET_ID: 'sheet-id',
			}),
		).toThrow('GOOGLE_CLIENT_EMAIL');
	});

	it('accepts partial Google config with only optional fields (empty)', () => {
		const env = loadEnv({ ...BASE_ENV });
		expect(env.GOOGLE_SHEETS_SPREADSHEET_ID).toBeUndefined();
	});
});
