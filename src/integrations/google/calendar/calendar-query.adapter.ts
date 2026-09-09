import { google, type calendar_v3 } from 'googleapis';
import type { GoogleAuthProvider } from '../auth.js';
import type { ICalendarQueryAdapter } from './calendar-query.interface.js';
import type { CalendarQueryEvent, CalendarQueryParams } from './calendar.types.js';
import { logger } from '../../../utils/logger.js';

const DEFAULT_MAX_RESULTS = 250;

function toStr(value: string | null | undefined, fallback = ''): string {
	return value ?? fallback;
}

function toOptionalStr(value: string | null | undefined): string | undefined {
	return value ?? undefined;
}

function normalizeEvent(event: calendar_v3.Schema$Event): CalendarQueryEvent {
	const isAllDay = !event.start?.dateTime;

	return {
		id: toStr(event.id),
		summary: toStr(event.summary),
		description: toOptionalStr(event.description),
		start: toStr(event.start?.dateTime),
		end: toStr(event.end?.dateTime),
		startDate: isAllDay ? toOptionalStr(event.start?.date) : undefined,
		endDate: isAllDay ? toOptionalStr(event.end?.date) : undefined,
		status: toStr(event.status, 'confirmed'),
		htmlLink: toOptionalStr(event.htmlLink),
		location: toOptionalStr(event.location),
		organizer: event.organizer
			? { email: toStr(event.organizer.email), displayName: toOptionalStr(event.organizer.displayName) }
			: undefined,
		attendees: event.attendees?.map((a) => ({
			email: toStr(a.email),
			displayName: toOptionalStr(a.displayName),
			responseStatus: toOptionalStr(a.responseStatus),
		})),
	};
}

export class GoogleCalendarQueryAdapter implements ICalendarQueryAdapter {
	private provider: GoogleAuthProvider;
	private calendarId: string;

	constructor(provider: GoogleAuthProvider, calendarId: string) {
		this.provider = provider;
		this.calendarId = calendarId;
	}

	private async getCalendar(): Promise<calendar_v3.Calendar> {
		const auth = await this.provider.getClient();
		return google.calendar({ version: 'v3', auth });
	}

	async queryEvents(params: CalendarQueryParams): Promise<CalendarQueryEvent[]> {
		const maxResults = params.maxResults ?? DEFAULT_MAX_RESULTS;

		try {
			const calendar = await this.getCalendar();
			const response = await calendar.events.list({
				calendarId: this.calendarId,
				timeMin: params.timeMin,
				timeMax: params.timeMax,
				maxResults,
				orderBy: 'startTime',
				singleEvents: true,
			});

			const items = response.data.items ?? [];

			logger.debug(
				{ calendarId: this.calendarId, count: items.length, timeMin: params.timeMin, timeMax: params.timeMax },
				'Calendar query completed',
			);

			return items.map(normalizeEvent);
		} catch (err) {
			logger.error(
				{ err, calendarId: this.calendarId, timeMin: params.timeMin, timeMax: params.timeMax },
				'Failed to query Google Calendar events',
			);
			throw err;
		}
	}
}
