import type { Lead } from '../../../types/lead.js';
import type { ISheetsAdapter } from './sheets.interface.js';
import { GoogleConnectionModel } from '../../../models/google-connection.model.js';
import { createOAuthUserProvider } from '../oauth-user-auth-provider.js';
import { GoogleSheetsAdapter } from './sheets.adapter.js';
import { logger } from '../../../utils/logger.js';

const SHEET_RANGE = 'Leads';
const HEADER_RANGE = 'Leads!1:1';
const GET_ROWS_MAX_ATTEMPTS = 3;

const HEADER_COLUMNS = [
	'telefone',
	'nome',
	'email',
	'contatoOrigem',
	'senioridade',
	'renda',
	'status',
	'dataAgendamento',
	'dataConversao',
	'tipoFechamento',
	'observacoes',
	'ultimaInteracao',
	'createdAt',
	'updatedAt',
] as const;

function formatDate(date: Date | undefined): string {
	if (!date) return '';
	return date.toISOString();
}

function mapLeadToRow(lead: Lead): unknown[] {
	return [
		lead.telefone,
		lead.nome,
		lead.email ?? '',
		lead.contatoOrigem,
		lead.senioridade ?? '',
		lead.renda ?? '',
		lead.status ?? '',
		formatDate(lead.dataAgendamento),
		formatDate(lead.dataConversao),
		lead.tipoFechamento ?? '',
		lead.observacoes ?? '',
		formatDate(lead.ultimaInteracao),
		formatDate(lead.createdAt),
		formatDate(lead.updatedAt),
	];
}

function findRowByTelefone(rows: unknown[][], telefone: string): number {
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (row && row[0] === telefone) {
			return i;
		}
	}
	return -1;
}

function isTransientError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	const code = 'code' in err ? (err as { code: number }).code : undefined;
	if (code === 429) return true;
	if (code === 408) return true;
	if (typeof code === 'number' && code >= 500) return true;
	if (code === undefined && ('ECONNRESET' in err || 'ETIMEDOUT' in err || 'ENOTFOUND' in err)) return true;
	return false;
}

async function getRowsWithRetry(
	sheetsAdapter: ISheetsAdapter,
	range: string,
): Promise<unknown[][]> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= GET_ROWS_MAX_ATTEMPTS; attempt++) {
		try {
			return await sheetsAdapter.getRows(range);
		} catch (err) {
			lastError = err;
			if (attempt < GET_ROWS_MAX_ATTEMPTS && isTransientError(err)) {
				logger.warn(
					{ err, range, attempt },
					'Transient error reading Sheets, retrying',
				);
				continue;
			}
			throw err;
		}
	}
	throw lastError;
}

async function ensureHeader(sheetsAdapter: ISheetsAdapter): Promise<void> {
	try {
		const existing = await getRowsWithRetry(sheetsAdapter, HEADER_RANGE);
		if (existing.length > 0 && existing[0] && existing[0].length > 0) {
			return;
		}

		await sheetsAdapter.appendRow(SHEET_RANGE, [HEADER_COLUMNS as unknown as unknown[]]);
		logger.debug('Sheets header row created');
	} catch (err) {
		logger.warn({ err }, 'Failed to ensure Sheets header, continuing');
	}
}

export interface SheetsProjectionInput {
	userId: string;
	lead: Lead;
}

export async function sheetsProjection(input: SheetsProjectionInput): Promise<void> {
	const { userId, lead } = input;

	try {
		const connection = await GoogleConnectionModel.findOne({ userId }).lean();
		if (!connection) {
			logger.warn(
				{ userId, leadId: lead.id },
				'No Google connection found for user, Sheets projection skipped',
			);
			return;
		}

		if (!connection.spreadsheetId) {
			logger.warn(
				{ userId, leadId: lead.id, connectionId: connection.id },
				'Google connection has no spreadsheetId, Sheets projection skipped',
			);
			return;
		}

		const provider = createOAuthUserProvider(userId);
		const sheetsAdapter: ISheetsAdapter = new GoogleSheetsAdapter(provider, connection.spreadsheetId);

		await ensureHeader(sheetsAdapter);

		const rows = await getRowsWithRetry(sheetsAdapter, SHEET_RANGE);
		const rowIndex = findRowByTelefone(rows, lead.telefone);
		const rowValues = mapLeadToRow(lead);

		if (rowIndex === -1) {
			await sheetsAdapter.appendRow(SHEET_RANGE, [rowValues]);
			logger.info(
				{
					userId,
					leadId: lead.id,
					telefone: lead.telefone,
					spreadsheetId: connection.spreadsheetId,
				},
				'Sheets projection completed (append)',
			);
		} else {
			const rowNum = rowIndex + 2;
			const range = `${SHEET_RANGE}!A${rowNum}`;
			await sheetsAdapter.updateRow(range, [rowValues]);
			logger.info(
				{
					userId,
					leadId: lead.id,
					telefone: lead.telefone,
					spreadsheetId: connection.spreadsheetId,
					row: rowNum,
				},
				'Sheets projection completed (update)',
			);
		}
	} catch (err) {
		logger.error(
			{ err, leadId: lead.id, userId, operation: 'sheetsProjection' },
			'Sheets projection failed',
		);
	}
}
