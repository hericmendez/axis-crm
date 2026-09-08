import { google, type sheets_v4 } from 'googleapis';
import type { GoogleAuthProvider } from '../auth.js';
import type { ISheetsAdapter } from './sheets.interface.js';
import type { SheetsAppendResult, SheetsUpdateResult } from './sheets.types.js';
import { logger } from '../../../utils/logger.js';

export class GoogleSheetsAdapter implements ISheetsAdapter {
	private provider: GoogleAuthProvider;
	private spreadsheetId: string;

	constructor(provider: GoogleAuthProvider, spreadsheetId: string) {
		this.provider = provider;
		this.spreadsheetId = spreadsheetId;
	}

	private async getSheets(): Promise<sheets_v4.Sheets> {
		const auth = await this.provider.getClient();
		return google.sheets({ version: 'v4', auth });
	}

	async appendRow(range: string, values: unknown[][]): Promise<SheetsAppendResult> {
		try {
			const sheets = await this.getSheets();
			const response = await sheets.spreadsheets.values.append({
				spreadsheetId: this.spreadsheetId,
				range,
				valueInputOption: 'USER_ENTERED',
				requestBody: {
					values,
				},
			});

			const updated = response.data.updates;
			logger.info(
				{
					spreadsheetId: this.spreadsheetId,
					range,
					updatedRows: updated?.updatedRows,
				},
				'Google Sheets row appended',
			);

			return {
				updatedCells: updated?.updatedCells ?? undefined,
				updatedRows: updated?.updatedRows ?? undefined,
			};
		} catch (err) {
			logger.error({ err, range }, 'Failed to append row to Google Sheets');
			throw err;
		}
	}

	async getRows(range: string): Promise<unknown[][]> {
		try {
			const sheets = await this.getSheets();
			const response = await sheets.spreadsheets.values.get({
				spreadsheetId: this.spreadsheetId,
				range,
			});

			return response.data.values ?? [];
		} catch (err) {
			logger.error({ err, range }, 'Failed to get rows from Google Sheets');
			throw err;
		}
	}

	async updateRow(range: string, values: unknown[][]): Promise<SheetsUpdateResult> {
		try {
			const sheets = await this.getSheets();
			const response = await sheets.spreadsheets.values.update({
				spreadsheetId: this.spreadsheetId,
				range,
				valueInputOption: 'USER_ENTERED',
				requestBody: {
					values,
				},
			});

			const updated = response.data.updatedCells;
			logger.info(
				{
					spreadsheetId: this.spreadsheetId,
					range,
					updatedCells: updated,
				},
				'Google Sheets row updated',
			);

			return {
				updatedCells: updated ?? undefined,
				updatedRows: response.data.updatedRows ?? undefined,
			};
		} catch (err) {
			logger.error({ err, range }, 'Failed to update row in Google Sheets');
			throw err;
		}
	}
}
