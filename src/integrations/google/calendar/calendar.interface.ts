import type { CalendarEvent, CalendarEventResult } from './calendar.types.js';

export interface ICalendarAdapter {
	createEvent(event: CalendarEvent): Promise<CalendarEventResult>;
	updateEvent(eventId: string, event: CalendarEvent): Promise<void>;
	deleteEvent(eventId: string): Promise<void>;
}
