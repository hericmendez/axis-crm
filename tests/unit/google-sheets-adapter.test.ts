import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ISheetsAdapter } from '../../src/integrations/google/sheets/sheets.interface.js';
import type { GoogleAuthProvider } from '../../src/integrations/google/auth.js';

function createMockSheetsAdapter(): ISheetsAdapter {
	return {
		appendRow: vi.fn().mockResolvedValue({ updatedCells: 5, updatedRows: 1 }),
		getRows: vi.fn().mockResolvedValue([['Name', 'Email'], ['Pedro', 'pedro@test.com']]),
	};
}

describe('Sheets Adapter (mocked interface)', () => {
	let adapter: ISheetsAdapter;

	beforeEach(() => {
		adapter = createMockSheetsAdapter();
	});

	it('appendRow returns update info', async () => {
		const result = await adapter.appendRow('Sheet1!A1', [['Pedro', '1699999']]);
		expect(result.updatedRows).toBe(1);
		expect(result.updatedCells).toBe(5);
	});

	it('appendRow calls with correct params', async () => {
		const values = [['Lead', 'Status']];
		await adapter.appendRow('Leads!A1', values);
		expect(adapter.appendRow).toHaveBeenCalledWith('Leads!A1', values);
	});

	it('getRows returns data', async () => {
		const rows = await adapter.getRows('Sheet1!A1:B2');
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual(['Name', 'Email']);
	});

	it('getRows empty range returns empty array', async () => {
		(adapter.getRows as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		const rows = await adapter.getRows('Empty!A1');
		expect(rows).toEqual([]);
	});

	it('appendRow error propagates', async () => {
		(adapter.appendRow as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Permission denied'));
		await expect(adapter.appendRow('A1', [])).rejects.toThrow('Permission denied');
	});

	it('getRows error propagates', async () => {
		(adapter.getRows as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Sheet not found'));
		await expect(adapter.getRows('Missing!A1')).rejects.toThrow('Sheet not found');
	});
});

describe('Sheets Interface contract', () => {
	it('adapter implements ISheetsAdapter', () => {
		const adapter = createMockSheetsAdapter();
		const _check: ISheetsAdapter = adapter;
		expect(_check).toBeDefined();
	});
});

describe('GoogleSheetsAdapter construction', () => {
	it('accepts GoogleAuthProvider instead of Auth.JWT', async () => {
		const mockGetClient = vi.fn().mockResolvedValue({
			setAccessToken: vi.fn(),
			authorize: vi.fn(),
		});
		const provider: GoogleAuthProvider = { getClient: mockGetClient };

		const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');
		const adapter = new GoogleSheetsAdapter(provider, 'test-spreadsheet-id');

		expect(adapter).toBeDefined();
		expect(typeof adapter.appendRow).toBe('function');
		expect(typeof adapter.getRows).toBe('function');
	});
});
