import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServiceAccountProvider, clearAuthCache } from '../../src/integrations/google/auth.js';
import { GoogleCalendarAdapter } from '../../src/integrations/google/calendar/calendar.adapter.js';
import type { CalendarEvent } from '../../src/integrations/google/calendar/calendar.types.js';

const EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const KEY = process.env.GOOGLE_PRIVATE_KEY;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

const hasCredentials = !!(EMAIL && KEY && CALENDAR_ID);

describe.skipIf(!hasCredentials)('Google Calendar — Runtime Integration', () => {
	let adapter: GoogleCalendarAdapter;
	let createdEventId: string | undefined;

	beforeAll(() => {
		clearAuthCache();
		const provider = createServiceAccountProvider({
			clientEmail: EMAIL!,
			privateKey: KEY!,
		});
		adapter = new GoogleCalendarAdapter(provider, CALENDAR_ID!);
	});

	afterAll(async () => {
		if (createdEventId) {
			try {
				await adapter.deleteEvent(createdEventId);
			} catch {
				// cleanup best-effort
			}
		}
		clearAuthCache();
	});

	it('authenticate and access calendar', async () => {
		const event: CalendarEvent = {
			summary: '[AXIS INTEGRATION TEST] Calendar Adapter — access check',
			start: new Date(Date.now() + 60 * 60 * 1000),
			end: new Date(Date.now() + 2 * 60 * 60 * 1000),
		};
		const result = await adapter.createEvent(event);
		expect(result.id).toBeTruthy();
		createdEventId = result.id;
	});

	it('create event', async () => {
		const now = new Date();
		const start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
		start.setHours(14, 0, 0, 0);
		const end = new Date(start.getTime() + 60 * 60 * 1000);

		const event: CalendarEvent = {
			summary: '[AXIS INTEGRATION TEST] Calendar Adapter CRUD',
			description: 'Automated integration test — do not modify',
			start,
			end,
		};

		const result = await adapter.createEvent(event);
		expect(result.id).toBeTruthy();
		expect(result.id).not.toBe('');
		createdEventId = result.id;
	});

	it('update event', async () => {
		expect(createdEventId).toBeTruthy();

		const updatedEvent: CalendarEvent = {
			summary: '[AXIS INTEGRATION TEST] Calendar Adapter — UPDATED',
			description: 'Updated by integration test',
			start: new Date(Date.now() + 25 * 60 * 60 * 1000),
			end: new Date(Date.now() + 26 * 60 * 60 * 1000),
		};

		await expect(adapter.updateEvent(createdEventId!, updatedEvent)).resolves.toBeUndefined();
	});

	it('delete event', async () => {
		expect(createdEventId).toBeTruthy();

		await expect(adapter.deleteEvent(createdEventId!)).resolves.toBeUndefined();
		createdEventId = undefined;
	});

	it('create → update → delete full lifecycle', async () => {
		let eventId: string | undefined;
		try {
			const createResult = await adapter.createEvent({
				summary: '[AXIS INTEGRATION TEST] Full lifecycle',
				start: new Date(Date.now() + 48 * 60 * 60 * 1000),
				end: new Date(Date.now() + 49 * 60 * 60 * 1000),
			});
			eventId = createResult.id;
			expect(eventId).toBeTruthy();

			await adapter.updateEvent(eventId!, {
				summary: '[AXIS INTEGRATION TEST] Full lifecycle — UPDATED',
				start: new Date(Date.now() + 50 * 60 * 60 * 1000),
				end: new Date(Date.now() + 51 * 60 * 60 * 1000),
			});

			await adapter.deleteEvent(eventId!);
			eventId = undefined;
		} finally {
			if (eventId) {
				try {
					await adapter.deleteEvent(eventId);
				} catch {
					// cleanup best-effort
				}
			}
		}
	});
});
