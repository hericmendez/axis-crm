/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ICalendarQueryAdapter } from '../../src/integrations/google/calendar/calendar-query.interface.js';
import type { CalendarQueryParams, CalendarQueryEvent } from '../../src/integrations/google/calendar/calendar.types.js';
import type { GoogleAuthProvider } from '../../src/integrations/google/auth.js';

vi.mock('../../src/utils/logger.js', () => ({
	logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockListFn = vi.fn().mockResolvedValue({ data: { items: [] } });

vi.mock('googleapis', () => ({
	google: {
		calendar: vi.fn().mockReturnValue({
			events: { list: mockListFn },
		}),
	},
}));

function createMockQueryAdapter(events: CalendarQueryEvent[] = []): ICalendarQueryAdapter {
	return {
		queryEvents: vi.fn().mockResolvedValue(events),
	};
}

function makeGoogleEvent(overrides: Record<string, any> = {}): any {
	return {
		id: 'gcal-event-1',
		summary: 'Reunião com João',
		description: 'Discussão sobre projeto',
		start: { dateTime: '2026-09-10T14:00:00-03:00', timeZone: 'America/Sao_Paulo' },
		end: { dateTime: '2026-09-10T15:00:00-03:00', timeZone: 'America/Sao_Paulo' },
		status: 'confirmed',
		htmlLink: 'https://calendar.google.com/event?id=gcal-event-1',
		location: 'Sala de reunião',
		organizer: { email: 'user@example.com', displayName: 'User' },
		attendees: [{ email: 'joao@example.com', displayName: 'João', responseStatus: 'accepted' }],
		...overrides,
	};
}

function makeAllDayEvent(overrides: Record<string, any> = {}): any {
	return {
		id: 'gcal-allday-1',
		summary: 'Feriado',
		start: { date: '2026-09-10' },
		end: { date: '2026-09-11' },
		status: 'confirmed',
		...overrides,
	};
}

describe('ICalendarQueryAdapter (contract)', () => {
	it('adapter implements ICalendarQueryAdapter', () => {
		const adapter = createMockQueryAdapter();
		const _check: ICalendarQueryAdapter = adapter;
		expect(_check).toBeDefined();
	});

	it('queryEvents returns CalendarQueryEvent[]', async () => {
		const adapter = createMockQueryAdapter([
			{ id: '1', summary: 'Test', start: '2026-09-10T14:00:00Z', end: '2026-09-10T15:00:00Z', status: 'confirmed' },
		]);
		const result = await adapter.queryEvents({ timeMin: '2026-09-10T00:00:00Z', timeMax: '2026-09-11T00:00:00Z' });
		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(1);
	});
});

describe('GoogleCalendarQueryAdapter', () => {
	let adapter: ICalendarQueryAdapter;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockListFn.mockResolvedValue({ data: { items: [] } });

		const mockProvider: GoogleAuthProvider = {
			getClient: vi.fn().mockResolvedValue({}),
		};

		const { GoogleCalendarQueryAdapter } = await import('../../src/integrations/google/calendar/calendar-query.adapter.js');
		adapter = new GoogleCalendarQueryAdapter(mockProvider, 'test-calendar-id');
	});

	it('queries events with correct parameters', async () => {
		const params: CalendarQueryParams = {
			timeMin: '2026-09-10T00:00:00-03:00',
			timeMax: '2026-09-11T00:00:00-03:00',
		};

		await adapter.queryEvents(params);

		expect(mockListFn).toHaveBeenCalledWith({
			calendarId: 'test-calendar-id',
			timeMin: '2026-09-10T00:00:00-03:00',
			timeMax: '2026-09-11T00:00:00-03:00',
			maxResults: 250,
			orderBy: 'startTime',
			singleEvents: true,
		});
	});

	it('uses persisted calendarId, not calendar name', async () => {
		await adapter.queryEvents({ timeMin: '2026-09-10T00:00:00Z', timeMax: '2026-09-11T00:00:00Z' });

		const callArgs = mockListFn.mock.calls[0][0];
		expect(callArgs.calendarId).toBe('test-calendar-id');
	});

	it('normalizes multiple events', async () => {
		mockListFn.mockResolvedValue({
			data: {
				items: [
					makeGoogleEvent({ id: 'e1', summary: 'Reunião 1' }),
					makeGoogleEvent({ id: 'e2', summary: 'Reunião 2' }),
					makeGoogleEvent({ id: 'e3', summary: 'Reunião 3' }),
				],
			},
		});

		const result = await adapter.queryEvents({
			timeMin: '2026-09-10T00:00:00Z',
			timeMax: '2026-09-11T00:00:00Z',
		});

		expect(result).toHaveLength(3);
		expect(result[0].id).toBe('e1');
		expect(result[1].id).toBe('e2');
		expect(result[2].id).toBe('e3');
	});

	it('returns empty array when no events exist', async () => {
		mockListFn.mockResolvedValue({ data: { items: [] } });

		const result = await adapter.queryEvents({
			timeMin: '2026-09-10T00:00:00Z',
			timeMax: '2026-09-11T00:00:00Z',
		});

		expect(result).toEqual([]);
	});

	it('returns empty array when items is undefined', async () => {
		mockListFn.mockResolvedValue({ data: {} });

		const result = await adapter.queryEvents({
			timeMin: '2026-09-10T00:00:00Z',
			timeMax: '2026-09-11T00:00:00Z',
		});

		expect(result).toEqual([]);
	});

	it('handles timed events with dateTime', async () => {
		mockListFn.mockResolvedValue({
			data: { items: [makeGoogleEvent()] },
		});

		const result = await adapter.queryEvents({
			timeMin: '2026-09-10T00:00:00Z',
			timeMax: '2026-09-11T00:00:00Z',
		});

		expect(result[0].start).toBe('2026-09-10T14:00:00-03:00');
		expect(result[0].end).toBe('2026-09-10T15:00:00-03:00');
		expect(result[0].startDate).toBeUndefined();
		expect(result[0].endDate).toBeUndefined();
	});

	it('handles all-day events with date', async () => {
		mockListFn.mockResolvedValue({
			data: { items: [makeAllDayEvent()] },
		});

		const result = await adapter.queryEvents({
			timeMin: '2026-09-10T00:00:00Z',
			timeMax: '2026-09-11T00:00:00Z',
		});

		expect(result[0].startDate).toBe('2026-09-10');
		expect(result[0].endDate).toBe('2026-09-11');
		expect(result[0].start).toBe('');
		expect(result[0].end).toBe('');
	});

	it('normalizes optional fields (location, organizer, attendees)', async () => {
		mockListFn.mockResolvedValue({
			data: { items: [makeGoogleEvent()] },
		});

		const result = await adapter.queryEvents({
			timeMin: '2026-09-10T00:00:00Z',
			timeMax: '2026-09-11T00:00:00Z',
		});

		expect(result[0].location).toBe('Sala de reunião');
		expect(result[0].organizer).toEqual({ email: 'user@example.com', displayName: 'User' });
		expect(result[0].attendees).toHaveLength(1);
		expect(result[0].attendees?.[0].email).toBe('joao@example.com');
	});

	it('uses custom maxResults when provided', async () => {
		await adapter.queryEvents({
			timeMin: '2026-09-10T00:00:00Z',
			timeMax: '2026-09-11T00:00:00Z',
			maxResults: 50,
		});

		const callArgs = mockListFn.mock.calls[0][0];
		expect(callArgs.maxResults).toBe(50);
	});

	it('propagates Google API errors', async () => {
		mockListFn.mockRejectedValue(new Error('Google API error'));

		await expect(
			adapter.queryEvents({
				timeMin: '2026-09-10T00:00:00Z',
				timeMax: '2026-09-11T00:00:00Z',
			}),
		).rejects.toThrow('Google API error');
	});

	it('normalizes event with missing optional fields', async () => {
		mockListFn.mockResolvedValue({
			data: {
				items: [
					{
						id: 'minimal',
						start: { dateTime: '2026-09-10T14:00:00Z' },
						end: { dateTime: '2026-09-10T15:00:00Z' },
					},
				],
			},
		});

		const result = await adapter.queryEvents({
			timeMin: '2026-09-10T00:00:00Z',
			timeMax: '2026-09-11T00:00:00Z',
		});

		expect(result[0].id).toBe('minimal');
		expect(result[0].summary).toBe('');
		expect(result[0].description).toBeUndefined();
		expect(result[0].location).toBeUndefined();
		expect(result[0].organizer).toBeUndefined();
		expect(result[0].attendees).toBeUndefined();
	});

	it('preserves status field', async () => {
		mockListFn.mockResolvedValue({
			data: { items: [makeGoogleEvent({ status: 'cancelled' })] },
		});

		const result = await adapter.queryEvents({
			timeMin: '2026-09-10T00:00:00Z',
			timeMax: '2026-09-11T00:00:00Z',
		});

		expect(result[0].status).toBe('cancelled');
	});
});
