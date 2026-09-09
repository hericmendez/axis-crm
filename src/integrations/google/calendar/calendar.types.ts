export interface CalendarEvent {
	id?: string;
	summary: string;
	description?: string;
	start: Date;
	end: Date;
}

export interface CalendarEventResult {
	id: string;
	htmlLink?: string;
}

export interface CalendarQueryEvent {
	id: string;
	summary: string;
	description?: string;
	start: string;
	end: string;
	startDate?: string;
	endDate?: string;
	status: string;
	htmlLink?: string;
	location?: string;
	organizer?: { email: string; displayName?: string };
	attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
}

export interface CalendarQueryParams {
	timeMin: string;
	timeMax: string;
	maxResults?: number;
}
