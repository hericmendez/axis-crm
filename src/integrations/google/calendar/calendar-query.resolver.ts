import { GoogleConnectionModel } from '../../../models/google-connection.model.js';
import { createOAuthUserProvider } from '../oauth-user-auth-provider.js';
import { GoogleCalendarQueryAdapter } from './calendar-query.adapter.js';
import type { ICalendarQueryAdapter } from './calendar-query.interface.js';

export type CalendarQueryResolution =
	| { status: 'OK'; adapter: ICalendarQueryAdapter }
	| { status: 'NO_CONNECTION' }
	| { status: 'NO_CALENDAR' };

export async function resolveUserCalendarQuery(userId: string): Promise<CalendarQueryResolution> {
	const connection = await GoogleConnectionModel.findOne({ userId }).lean();
	if (!connection) {
		return { status: 'NO_CONNECTION' };
	}
	if (!connection.calendarId) {
		return { status: 'NO_CALENDAR' };
	}
	const provider = createOAuthUserProvider(userId);
	return { status: 'OK', adapter: new GoogleCalendarQueryAdapter(provider, connection.calendarId) };
}
