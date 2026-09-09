import type { CalendarQueryEvent, CalendarQueryParams } from './calendar.types.js';

export interface ICalendarQueryAdapter {
	queryEvents(params: CalendarQueryParams): Promise<CalendarQueryEvent[]>;
}
