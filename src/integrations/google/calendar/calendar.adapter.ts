import { google, type calendar_v3 } from 'googleapis';
import type { GoogleAuthProvider } from '../auth.js';
import type { ICalendarAdapter } from './calendar.interface.js';
import type { CalendarEvent, CalendarEventResult } from './calendar.types.js';
import { logger } from '../../../utils/logger.js';

const BASE32HEX_CHARS = '0123456789abcdefghijklmnopqrstuv';

function toBase32Hex(hex: string): string {
	let bits = '';
	for (const c of hex) {
		bits += parseInt(c, 16).toString(2).padStart(4, '0');
	}
	while (bits.length % 5 !== 0) bits += '0';
	let result = '';
	for (let i = 0; i < bits.length; i += 5) {
		result += BASE32HEX_CHARS[Number.parseInt(bits.substring(i, i + 5), 2)];
	}
	return result;
}

export function eventoIdToGoogleEventId(eventoId: string): string {
	return toBase32Hex(eventoId);
}

export class GoogleCalendarAdapter implements ICalendarAdapter {
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

	async createEvent(event: CalendarEvent): Promise<CalendarEventResult> {
		try {
			const calendar = await this.getCalendar();
			const response = await calendar.events.insert({
				calendarId: this.calendarId,
				requestBody: {
					...(event.id ? { id: event.id } : {}),
					summary: event.summary,
					description: event.description,
					start: {
						dateTime: event.start.toISOString(),
						timeZone: 'America/Sao_Paulo',
					},
					end: {
						dateTime: event.end.toISOString(),
						timeZone: 'America/Sao_Paulo',
					},
				},
			});

			const created = response.data;
			logger.info(
				{ calendarEventId: created.id, summary: event.summary },
				'Google Calendar event created',
			);

			return {
				id: created.id ?? '',
				htmlLink: created.htmlLink ?? undefined,
			};
		} catch (err) {
			logger.error({ err, summary: event.summary }, 'Failed to create Google Calendar event');
			throw err;
		}
	}

	async updateEvent(eventId: string, event: CalendarEvent): Promise<void> {
		try {
			const calendar = await this.getCalendar();
			await calendar.events.update({
				calendarId: this.calendarId,
				eventId,
				requestBody: {
					summary: event.summary,
					description: event.description,
					start: {
						dateTime: event.start.toISOString(),
						timeZone: 'America/Sao_Paulo',
					},
					end: {
						dateTime: event.end.toISOString(),
						timeZone: 'America/Sao_Paulo',
					},
				},
			});

			logger.info({ calendarEventId: eventId, summary: event.summary }, 'Google Calendar event updated');
		} catch (err) {
			logger.error({ err, calendarEventId: eventId }, 'Failed to update Google Calendar event');
			throw err;
		}
	}

	async deleteEvent(eventId: string): Promise<void> {
		try {
			const calendar = await this.getCalendar();
			await calendar.events.delete({
				calendarId: this.calendarId,
				eventId,
			});

			logger.info({ calendarEventId: eventId }, 'Google Calendar event deleted');
		} catch (err) {
			logger.error({ err, calendarEventId: eventId }, 'Failed to delete Google Calendar event');
			throw err;
		}
	}
}
