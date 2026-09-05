import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ICalendarAdapter } from '../../src/integrations/google/calendar/calendar.interface.js';
import type { CalendarEvent } from '../../src/integrations/google/calendar/calendar.types.js';
import type { GoogleAuthProvider } from '../../src/integrations/google/auth.js';

function createMockCalendarAdapter(): ICalendarAdapter {
	return {
		createEvent: vi.fn().mockResolvedValue({ id: 'cal-event-1', htmlLink: 'https://calendar.google.com' }),
		updateEvent: vi.fn().mockResolvedValue(undefined),
		deleteEvent: vi.fn().mockResolvedValue(undefined),
	};
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
	return {
		summary: 'Call com Pedro Lucas',
		start: new Date('2026-08-28T14:00:00Z'),
		end: new Date('2026-08-28T15:00:00Z'),
		...overrides,
	};
}

describe('Calendar Adapter (mocked interface)', () => {
	let adapter: ICalendarAdapter;

	beforeEach(() => {
		adapter = createMockCalendarAdapter();
	});

	it('createEvent returns event id', async () => {
		const result = await adapter.createEvent(makeEvent());
		expect(result.id).toBe('cal-event-1');
		expect(result.htmlLink).toBeDefined();
	});

	it('createEvent calls with correct params', async () => {
		const event = makeEvent({ summary: 'Reunião', description: 'Teste' });
		await adapter.createEvent(event);
		expect(adapter.createEvent).toHaveBeenCalledWith(event);
	});

	it('updateEvent resolves', async () => {
		await expect(adapter.updateEvent('cal-event-1', makeEvent())).resolves.toBeUndefined();
	});

	it('deleteEvent resolves', async () => {
		await expect(adapter.deleteEvent('cal-event-1')).resolves.toBeUndefined();
	});

	it('createEvent error propagates', async () => {
		(adapter.createEvent as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));
		await expect(adapter.createEvent(makeEvent())).rejects.toThrow('API error');
	});

	it('updateEvent error propagates', async () => {
		(adapter.updateEvent as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Not found'));
		await expect(adapter.updateEvent('nonexistent', makeEvent())).rejects.toThrow('Not found');
	});

	it('deleteEvent error propagates', async () => {
		(adapter.deleteEvent as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Not found'));
		await expect(adapter.deleteEvent('nonexistent')).rejects.toThrow('Not found');
	});
});

describe('Calendar Interface contract', () => {
	it('adapter implements ICalendarAdapter', () => {
		const adapter = createMockCalendarAdapter();
		const _check: ICalendarAdapter = adapter;
		expect(_check).toBeDefined();
	});
});

describe('GoogleCalendarAdapter construction', () => {
	it('accepts GoogleAuthProvider instead of Auth.JWT', async () => {
		const mockGetClient = vi.fn().mockResolvedValue({
			setAccessToken: vi.fn(),
			authorize: vi.fn(),
		});
		const provider: GoogleAuthProvider = { getClient: mockGetClient };

		const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');
		const adapter = new GoogleCalendarAdapter(provider, 'test-calendar-id');

		expect(adapter).toBeDefined();
		expect(typeof adapter.createEvent).toBe('function');
		expect(typeof adapter.updateEvent).toBe('function');
		expect(typeof adapter.deleteEvent).toBe('function');
	});
});
