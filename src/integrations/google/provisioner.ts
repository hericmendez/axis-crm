import { google } from 'googleapis';
import { GoogleConnectionModel } from '../../models/google-connection.model.js';
import { createOAuthUserProvider } from './oauth-user-auth-provider.js';
import { logger } from '../../utils/logger.js';

const CALENDAR_NAME = 'Axis CRM';
const SPREADSHEET_NAME = 'Axis CRM';

export interface ProvisionResult {
	calendarId: string | null;
	spreadsheetId: string | null;
}

interface ConnectionState {
	userId: string;
	calendarId?: string | null;
	spreadsheetId?: string | null;
}

async function ensureCalendar(state: ConnectionState): Promise<string> {
	if (state.calendarId) {
		logger.debug({ userId: state.userId, calendarId: state.calendarId }, 'Calendar already provisioned');
		return state.calendarId;
	}

	const provider = createOAuthUserProvider(state.userId);
	const auth = await provider.getClient();
	const calendar = google.calendar({ version: 'v3', auth });

	const created = await calendar.calendars.insert({
		requestBody: {
			summary: CALENDAR_NAME,
			description: 'Calendar managed by Axis CRM',
			timeZone: 'America/Sao_Paulo',
		},
	});

	const calendarId = created.data.id!;
	await GoogleConnectionModel.findOneAndUpdate(
		{ userId: state.userId },
		{ calendarId },
	);
	logger.info({ userId: state.userId, calendarId }, 'Axis CRM calendar created');
	return calendarId;
}

async function ensureSpreadsheet(state: ConnectionState): Promise<string> {
	if (state.spreadsheetId) {
		logger.debug({ userId: state.userId, spreadsheetId: state.spreadsheetId }, 'Spreadsheet already provisioned');
		return state.spreadsheetId;
	}

	const provider = createOAuthUserProvider(state.userId);
	const auth = await provider.getClient();
	const sheets = google.sheets({ version: 'v4', auth });

	const created = await sheets.spreadsheets.create({
		requestBody: {
			properties: {
				title: SPREADSHEET_NAME,
			},
			sheets: [
				{
					properties: {
						title: 'Leads',
					},
				},
			],
		},
	});

	const spreadsheetId = created.data.spreadsheetId!;
	await GoogleConnectionModel.findOneAndUpdate(
		{ userId: state.userId },
		{ spreadsheetId },
	);
	logger.info({ userId: state.userId, spreadsheetId }, 'Axis CRM spreadsheet created');
	return spreadsheetId;
}

/**
 * Provision Google resources for a user.
 *
 * Idempotency: uses persisted calendarId/spreadsheetId as identity.
 * If ID exists, resource is assumed to exist and is reused.
 * If ID doesn't exist, a new resource is created.
 *
 * Limitation: if creation succeeds but persistence fails (timeout/network),
 * a retry may create a duplicate resource. Google APIs do not support
 * idempotency keys for calendars.insert or spreadsheets.create.
 * This is an accepted limitation of the current architecture.
 */
export async function provision(userId: string): Promise<ProvisionResult> {
	const connection = await GoogleConnectionModel.findOne({ userId }).lean();
	if (!connection) {
		throw new Error(`No Google connection for user ${userId}`);
	}

	const state: ConnectionState = {
		userId,
		calendarId: connection.calendarId,
		spreadsheetId: connection.spreadsheetId,
	};

	let calendarId: string | null = null;
	let spreadsheetId: string | null = null;

	try {
		calendarId = await ensureCalendar(state);
	} catch (err) {
		logger.error({ err, userId }, 'Failed to provision Calendar');
	}

	try {
		spreadsheetId = await ensureSpreadsheet(state);
	} catch (err) {
		logger.error({ err, userId }, 'Failed to provision Spreadsheet');
	}

	return { calendarId, spreadsheetId };
}
