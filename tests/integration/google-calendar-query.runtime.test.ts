import { config } from 'dotenv';
import { resolve } from 'path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { createOAuthUserProvider } from '../../src/integrations/google/oauth-user-auth-provider.js';
import { GoogleCalendarQueryAdapter } from '../../src/integrations/google/calendar/calendar-query.adapter.js';
import { GoogleCalendarAdapter } from '../../src/integrations/google/calendar/calendar.adapter.js';
import { GoogleConnectionModel } from '../../src/models/google-connection.model.js';

const { parsed } = config({ path: resolve(process.cwd(), '.env') });
const MONGO_URI = parsed?.MONGO_URI ?? process.env.MONGO_URI;

describe.skipIf(!MONGO_URI)('Google Calendar Query — Runtime Integration', () => {
	let adapter: GoogleCalendarQueryAdapter;
	let writeAdapter: GoogleCalendarAdapter;
	let calendarId: string;
	let userId: string;
	let createdEventId: string | undefined;

	beforeAll(async () => {
		await mongoose.connect(MONGO_URI!);

		const connection = await GoogleConnectionModel.findOne().lean();
		if (!connection) {
			throw new Error('No GoogleConnection found in database — run PASSO 3.8 runtime validation first');
		}

		userId = connection.userId;
		calendarId = connection.calendarId ?? '';

		if (!calendarId) {
			throw new Error('GoogleConnection has no calendarId — provisioning may not have run');
		}

		const provider = createOAuthUserProvider(userId);
		adapter = new GoogleCalendarQueryAdapter(provider, calendarId);
		writeAdapter = new GoogleCalendarAdapter(provider, calendarId);
	});

	afterAll(async () => {
		if (createdEventId) {
			try {
				await writeAdapter.deleteEvent(createdEventId);
			} catch {
				// cleanup best-effort
			}
		}
		await mongoose.disconnect();
	});

	it('GoogleConnection resolution', async () => {
		expect(userId).toBeTruthy();
		expect(calendarId).toBeTruthy();
	});

	it('Calendar ID resolution', () => {
		expect(calendarId).not.toBe('');
		expect(typeof calendarId).toBe('string');
	});

	it('create test event for query validation', async () => {
		const now = new Date();
		const start = new Date(now.getTime() + 2 * 60 * 60 * 1000);
		start.setMinutes(0, 0, 0);
		const end = new Date(start.getTime() + 60 * 60 * 1000);

		const result = await writeAdapter.createEvent({
			summary: '[AXIS TEST] Query Adapter Validation',
			description: 'Created for runtime query validation — safe to delete',
			start,
			end,
		});

		expect(result.id).toBeTruthy();
		createdEventId = result.id;
	});

	it('real Calendar query returns events', async () => {
		const now = new Date();
		const timeMin = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
		const timeMax = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

		const events = await adapter.queryEvents({ timeMin, timeMax });

		expect(Array.isArray(events)).toBe(true);
		expect(events.length).toBeGreaterThanOrEqual(1);
	});

	it('timed event is normalized correctly', async () => {
		const now = new Date();
		const timeMin = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
		const timeMax = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

		const events = await adapter.queryEvents({ timeMin, timeMax });

		const testEvent = events.find((e) => e.summary.includes('Query Adapter Validation'));
		expect(testEvent).toBeDefined();
		expect(testEvent!.id).toBeTruthy();
		expect(testEvent!.start).toBeTruthy();
		expect(testEvent!.end).toBeTruthy();
		expect(testEvent!.status).toBeDefined();
	});

	it('empty range returns empty array', async () => {
		const timeMin = '2020-01-01T00:00:00Z';
		const timeMax = '2020-01-02T00:00:00Z';

		const events = await adapter.queryEvents({ timeMin, timeMax });

		expect(events).toEqual([]);
	});

	it('existing Axis-created event is readable', async () => {
		expect(createdEventId).toBeTruthy();

		const now = new Date();
		const timeMin = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
		const timeMax = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();

		const events = await adapter.queryEvents({ timeMin, timeMax });

		const axisEvent = events.find((e) => e.summary.includes('Query Adapter Validation'));
		expect(axisEvent).toBeDefined();
		expect(axisEvent!.id).toBe(createdEventId);
	});
});
