import type { SheetsAppendResult, SheetsUpdateResult } from './sheets.types.js';

export interface ISheetsAdapter {
	appendRow(range: string, values: unknown[][]): Promise<SheetsAppendResult>;
	getRows(range: string): Promise<unknown[][]>;
	updateRow(range: string, values: unknown[][]): Promise<SheetsUpdateResult>;
}
