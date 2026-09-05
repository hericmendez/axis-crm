import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { createServiceAccountProvider, clearAuthCache } from '../../src/integrations/google/auth.js';
import { GoogleSheetsAdapter } from '../../src/integrations/google/sheets/sheets.adapter.js';

const EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const KEY = process.env.GOOGLE_PRIVATE_KEY;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

const hasCredentials = !!(EMAIL && KEY && SPREADSHEET_ID);

describe.skipIf(!hasCredentials)('Google Sheets — Runtime Integration', () => {
	let adapter: GoogleSheetsAdapter;
	let sheetName: string;

	beforeAll(async () => {
		clearAuthCache();
		const provider = createServiceAccountProvider({
			clientEmail: EMAIL!,
			privateKey: KEY!,
		});
		adapter = new GoogleSheetsAdapter(provider, SPREADSHEET_ID!);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const sheets = await (adapter as any).getSheets();
		const meta = await sheets.spreadsheets.get({
			spreadsheetId: SPREADSHEET_ID!,
			fields: 'sheets.properties.title',
		});
		sheetName = meta.data.sheets?.[0]?.properties?.title ?? 'Sheet1';
	});

	it('authenticate and access spreadsheet', async () => {
		const rows = await adapter.getRows(`${sheetName}!A1:A1`);
		expect(Array.isArray(rows)).toBe(true);
	});

	it('append row and read it back', async () => {
		const testId = `AXIS_INTEGRATION_TEST_${Date.now()}`;
		const values = [[testId, new Date().toISOString(), 'Google Sheets Adapter Runtime Validation']];

		const appendResult = await adapter.appendRow(`${sheetName}!A1:C1`, values);
		expect(appendResult.updatedRows).toBeGreaterThanOrEqual(1);

		const allRows = await adapter.getRows(`${sheetName}!A:A`);
		const found = allRows.some(
			(row) => Array.isArray(row) && row[0] === testId,
		);
		expect(found).toBe(true);
	});
});
