export interface CalendarEvent {
	summary: string;
	description?: string;
	start: Date;
	end: Date;
}

export interface CalendarEventResult {
	id: string;
	htmlLink?: string;
}
