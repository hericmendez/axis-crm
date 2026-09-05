import type { SheetsAppendResult } from './sheets.types.js';

export interface ISheetsAdapter {
	appendRow(range: string, values: unknown[][]): Promise<SheetsAppendResult>;
	getRows(range: string): Promise<unknown[][]>;
}
