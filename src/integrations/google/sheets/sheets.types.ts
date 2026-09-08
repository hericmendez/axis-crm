export interface SheetsAppendResult {
	updatedCells?: number;
	updatedRows?: number;
}

export interface SheetsUpdateResult {
	updatedCells?: number;
	updatedRows?: number;
}

export interface SheetsRow {
	values: unknown[][];
}
