import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCalendarInsert, mockSheetsCreate } = vi.hoisted(() => ({
	mockCalendarInsert: vi.fn().mockResolvedValue({ data: { id: 'new-cal-id' } }),
	mockSheetsCreate: vi.fn().mockResolvedValue({ data: { spreadsheetId: 'new-sheet-id' } }),
}));

vi.mock('../../src/config/env.js', () => ({
	getEnv: vi.fn().mockReturnValue({
		GOOGLE_OAUTH_CLIENT_ID: 'test-client-id',
		GOOGLE_OAUTH_CLIENT_SECRET: 'test-client-secret',
		GOOGLE_OAUTH_REDIRECT_URI: 'http://localhost:3000/callback',
	}),
}));

vi.mock('googleapis', () => ({
	google: {
		auth: {
			OAuth2: vi.fn().mockImplementation(() => ({
				setCredentials: vi.fn(),
			})),
		},
		calendar: vi.fn().mockReturnValue({
			calendars: { insert: mockCalendarInsert },
		}),
		sheets: vi.fn().mockReturnValue({
			spreadsheets: { create: mockSheetsCreate },
		}),
	},
}));

vi.mock('../../src/models/google-connection.model.js', () => ({
	GoogleConnectionModel: {
		findOne: vi.fn().mockReturnValue({
			lean: vi.fn().mockResolvedValue({
				userId: 'user-123',
				email: 'user@gmail.com',
				refreshToken: 'mock-rt',
				calendarId: undefined,
				spreadsheetId: undefined,
			}),
		}),
		findOneAndUpdate: vi.fn().mockResolvedValue({}),
	},
}));

vi.mock('../../src/models/user.model.js', () => ({
	UserModel: {
		findOne: vi.fn().mockReturnValue({
			select: vi.fn().mockReturnValue({
				lean: vi.fn().mockResolvedValue({ _id: 'user-123' }),
			}),
		}),
		create: vi.fn().mockResolvedValue({ _id: 'user-123' }),
	},
}));

import { provision } from '../../src/integrations/google/provisioner.js';
import { GoogleConnectionModel } from '../../src/models/google-connection.model.js';

describe('GoogleIntegrationProvisioner', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates calendar and spreadsheet when not provisioned', async () => {
		const result = await provision('user-123');
		expect(result.calendarId).toBe('new-cal-id');
		expect(result.spreadsheetId).toBe('new-sheet-id');
		expect(mockCalendarInsert).toHaveBeenCalled();
		expect(mockSheetsCreate).toHaveBeenCalled();
	});

	it('reuses persisted calendarId without API call', async () => {
		vi.mocked(GoogleConnectionModel.findOne).mockReturnValueOnce({
			lean: vi.fn().mockResolvedValue({
				userId: 'user-123',
				calendarId: 'existing-cal-id',
				spreadsheetId: undefined,
			}),
		} as never);

		const result = await provision('user-123');
		expect(result.calendarId).toBe('existing-cal-id');
		expect(mockCalendarInsert).not.toHaveBeenCalled();
	});

	it('reuses persisted spreadsheetId without API call', async () => {
		vi.mocked(GoogleConnectionModel.findOne).mockReturnValueOnce({
			lean: vi.fn().mockResolvedValue({
				userId: 'user-123',
				calendarId: undefined,
				spreadsheetId: 'existing-sheet-id',
			}),
		} as never);

		const result = await provision('user-123');
		expect(result.spreadsheetId).toBe('existing-sheet-id');
		expect(mockSheetsCreate).not.toHaveBeenCalled();
	});

	it('manual "Axis CRM" calendar does not interfere', async () => {
		vi.mocked(GoogleConnectionModel.findOne).mockReturnValueOnce({
			lean: vi.fn().mockResolvedValue({
				userId: 'user-123',
				calendarId: undefined,
				spreadsheetId: undefined,
			}),
		} as never);

		const result = await provision('user-123');
		expect(result.calendarId).toBe('new-cal-id');
		expect(mockCalendarInsert).toHaveBeenCalledTimes(1);
	});

	it('manual "Axis CRM" spreadsheet does not interfere', async () => {
		vi.mocked(GoogleConnectionModel.findOne).mockReturnValueOnce({
			lean: vi.fn().mockResolvedValue({
				userId: 'user-123',
				calendarId: undefined,
				spreadsheetId: undefined,
			}),
		} as never);

		const result = await provision('user-123');
		expect(result.spreadsheetId).toBe('new-sheet-id');
		expect(mockSheetsCreate).toHaveBeenCalledTimes(1);
	});

	it('handles calendar creation failure gracefully', async () => {
		mockCalendarInsert.mockRejectedValueOnce(new Error('Calendar API error'));

		const result = await provision('user-123');
		expect(result.calendarId).toBeNull();
		expect(result.spreadsheetId).toBe('new-sheet-id');
	});

	it('handles spreadsheet creation failure gracefully', async () => {
		mockSheetsCreate.mockRejectedValueOnce(new Error('Sheets API error'));

		const result = await provision('user-123');
		expect(result.calendarId).toBe('new-cal-id');
		expect(result.spreadsheetId).toBeNull();
	});

	it('retry after partial failure does not recreate calendar', async () => {
		let callCount = 0;
		vi.mocked(GoogleConnectionModel.findOne).mockImplementation(() => ({
			lean: vi.fn().mockImplementation(() => {
				callCount++;
				return Promise.resolve(
					callCount === 1
						? { userId: 'user-123', calendarId: undefined, spreadsheetId: undefined }
						: { userId: 'user-123', calendarId: 'new-cal-id', spreadsheetId: undefined },
				);
			}),
		}) as never);

		mockSheetsCreate.mockRejectedValueOnce(new Error('Sheets API error'));

		await provision('user-123');
		expect(mockCalendarInsert).toHaveBeenCalledTimes(1);
		expect(mockSheetsCreate).toHaveBeenCalledTimes(1);

		await provision('user-123');
		expect(mockCalendarInsert).toHaveBeenCalledTimes(1);
		expect(mockSheetsCreate).toHaveBeenCalledTimes(2);
	});

	it('throws when no Google connection exists', async () => {
		vi.mocked(GoogleConnectionModel.findOne).mockReturnValueOnce({
			lean: vi.fn().mockResolvedValue(null),
		} as never);

		await expect(provision('user-no-conn')).rejects.toThrow('No Google connection');
	});

	it('is idempotent when both IDs persist', async () => {
		let callCount = 0;
		vi.mocked(GoogleConnectionModel.findOne).mockImplementation(() => ({
			lean: vi.fn().mockImplementation(() => {
				callCount++;
				return Promise.resolve(
					callCount === 1
						? { userId: 'user-123', calendarId: undefined, spreadsheetId: undefined }
						: { userId: 'user-123', calendarId: 'new-cal-id', spreadsheetId: 'new-sheet-id' },
				);
			}),
		}) as never);

		await provision('user-123');
		await provision('user-123');

		expect(mockCalendarInsert).toHaveBeenCalledTimes(1);
		expect(mockSheetsCreate).toHaveBeenCalledTimes(1);
	});
});
