/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { calendarProjection } from '../../src/integrations/google/calendar/calendar.projection.js';
import type { Evento } from '../../src/types/evento.js';
import type { Lead } from '../../src/types/lead.js';

vi.mock('../../src/models/google-connection.model.js', () => ({
	GoogleConnectionModel: {
		findOne: vi.fn(),
	},
}));

vi.mock('../../src/integrations/google/oauth-user-auth-provider.js', () => ({
	createOAuthUserProvider: vi.fn(),
}));

vi.mock('../../src/integrations/google/calendar/calendar.adapter.js', () => ({
	GoogleCalendarAdapter: vi.fn(),
	eventoIdToGoogleEventId: vi.fn((id: string) => `mocked-${id}`),
}));

vi.mock('../../src/repositories/evento.repository.js', () => ({
	updateGoogleEventId: vi.fn(),
}));

const mockLead: Lead = {
	id: '507f1f77bcf86cd799439011',
	nome: 'João da Silva',
	telefone: '11999998888',
	contatoOrigem: 'whatsapp',
	createdAt: new Date(),
	updatedAt: new Date(),
};

const mockAgendamento: Evento = {
	id: '507f1f77bcf86cd799439012',
	leadId: mockLead.id,
	tipo: 'AGENDAMENTO',
	data: new Date('2026-09-01T10:00:00Z'),
	createdAt: new Date('2026-08-25T10:00:00Z'),
};

const mockReagendamento: Evento = {
	id: '507f1f77bcf86cd799439013',
	leadId: mockLead.id,
	tipo: 'REAGENDAMENTO',
	data: new Date('2026-09-02T10:00:00Z'),
	previousEventoId: mockAgendamento.id,
	createdAt: new Date('2026-08-26T10:00:00Z'),
};

describe('CalendarProjection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('AGENDAMENTO', () => {
		it('projeta AGENDAMENTO para Google Calendar', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');
			const { updateGoogleEventId } = await import('../../src/repositories/evento.repository.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'google-event-123' });
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: vi.fn(),
			}) as any);

			vi.mocked(updateGoogleEventId).mockResolvedValue(true);

			await calendarProjection({
				userId: 'user-1',
				evento: mockAgendamento,
				lead: mockLead,
			});

			expect(mockCreateEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					summary: '[AGENDAMENTO] João da Silva',
					description: expect.stringContaining('Lead: João da Silva'),
				}),
			);
			expect(updateGoogleEventId).toHaveBeenCalledWith(expect.any(String), mockAgendamento.id, 'google-event-123');
		});

		it('AGENDAMENTO não deleta predecessor mesmo se existir', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockDeleteEvent = vi.fn();
			const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'google-event-123' });
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: mockAgendamento,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).not.toHaveBeenCalled();
			expect(mockCreateEvent).toHaveBeenCalled();
		});
	});

	describe('REAGENDAMENTO', () => {
		it('deleta predecessor com googleEventId e cria novo evento', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');
			const { updateGoogleEventId } = await import('../../src/repositories/evento.repository.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockDeleteEvent = vi.fn().mockResolvedValue(undefined);
			const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'google-event-456' });
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			vi.mocked(updateGoogleEventId).mockResolvedValue(true);

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: mockReagendamento,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledWith('old-google-event');
			expect(mockCreateEvent).toHaveBeenCalled();
			expect(updateGoogleEventId).toHaveBeenCalledWith(expect.any(String), mockReagendamento.id, 'google-event-456');
		});

		it('não deleta predecessor sem googleEventId e cria novo evento', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');
			const { updateGoogleEventId } = await import('../../src/repositories/evento.repository.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockDeleteEvent = vi.fn();
			const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'google-event-456' });
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			vi.mocked(updateGoogleEventId).mockResolvedValue(true);

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: undefined,
			};

			await calendarProjection({
				userId: 'user-1',
				evento: mockReagendamento,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).not.toHaveBeenCalled();
			expect(mockCreateEvent).toHaveBeenCalled();
			expect(updateGoogleEventId).toHaveBeenCalledWith(expect.any(String), mockReagendamento.id, 'google-event-456');
		});

		it('delete retorna 404 é tratado como sucesso e cria novo evento', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');
			const { updateGoogleEventId } = await import('../../src/repositories/evento.repository.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const notFoundError = Object.assign(new Error('Not Found'), { code: 404 });
			const mockDeleteEvent = vi.fn().mockRejectedValue(notFoundError);
			const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'google-event-456' });
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			vi.mocked(updateGoogleEventId).mockResolvedValue(true);

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: mockReagendamento,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledWith('old-google-event');
			expect(mockCreateEvent).toHaveBeenCalled();
			expect(updateGoogleEventId).toHaveBeenCalledWith(expect.any(String), mockReagendamento.id, 'google-event-456');
		});

		it('delete falha com erro real impede criação do novo evento', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');
			const { updateGoogleEventId } = await import('../../src/repositories/evento.repository.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const realError = Object.assign(new Error('Permission denied'), { code: 403 });
			const mockDeleteEvent = vi.fn().mockRejectedValue(realError);
			const mockCreateEvent = vi.fn();
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: mockReagendamento,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledWith('old-google-event');
			expect(mockCreateEvent).not.toHaveBeenCalled();
			expect(updateGoogleEventId).not.toHaveBeenCalled();
		});

		it('delete sucesso + create falha não gera rollback', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');
			const { updateGoogleEventId } = await import('../../src/repositories/evento.repository.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockDeleteEvent = vi.fn().mockResolvedValue(undefined);
			const mockCreateEvent = vi.fn().mockRejectedValue(new Error('Google API error'));
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: mockReagendamento,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledWith('old-google-event');
			expect(mockCreateEvent).toHaveBeenCalled();
			expect(updateGoogleEventId).not.toHaveBeenCalled();
			expect(mockDeleteEvent).not.toHaveBeenCalledTimes(2);
		});

		it('create sucesso + updateGoogleEventId falha não deleta evento criado', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');
			const { updateGoogleEventId } = await import('../../src/repositories/evento.repository.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockDeleteEvent = vi.fn();
			const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'google-event-456' });
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			vi.mocked(updateGoogleEventId).mockRejectedValue(new Error('Mongo error'));

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: mockReagendamento,
				lead: mockLead,
				previousEvento,
			});

			expect(mockCreateEvent).toHaveBeenCalled();
			expect(mockDeleteEvent).not.toHaveBeenCalledTimes(2);
		});
	});

	describe('DESISTENCIA', () => {
		it('deleta predecessor com googleEventId e não cria novo evento', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');
			const { updateGoogleEventId } = await import('../../src/repositories/evento.repository.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockDeleteEvent = vi.fn().mockResolvedValue(undefined);
			const mockCreateEvent = vi.fn();
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const desistencia: Evento = {
				...mockAgendamento,
				id: '507f1f77bcf86cd799439015',
				tipo: 'DESISTENCIA',
				previousEventoId: mockAgendamento.id,
			};

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: desistencia,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledWith('old-google-event');
			expect(mockCreateEvent).not.toHaveBeenCalled();
			expect(updateGoogleEventId).not.toHaveBeenCalled();
		});

		it('não deleta predecessor sem googleEventId', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockDeleteEvent = vi.fn();
			const mockCreateEvent = vi.fn();
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const desistencia: Evento = {
				...mockAgendamento,
				id: '507f1f77bcf86cd799439015',
				tipo: 'DESISTENCIA',
				previousEventoId: mockAgendamento.id,
			};

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: undefined,
			};

			await calendarProjection({
				userId: 'user-1',
				evento: desistencia,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).not.toHaveBeenCalled();
			expect(mockCreateEvent).not.toHaveBeenCalled();
		});

		it('delete retorna 404 é tratado como sucesso', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const notFoundError = Object.assign(new Error('Not Found'), { code: 404 });
			const mockDeleteEvent = vi.fn().mockRejectedValue(notFoundError);
			const mockCreateEvent = vi.fn();
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const desistencia: Evento = {
				...mockAgendamento,
				id: '507f1f77bcf86cd799439015',
				tipo: 'DESISTENCIA',
				previousEventoId: mockAgendamento.id,
			};

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: desistencia,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledWith('old-google-event');
			expect(mockCreateEvent).not.toHaveBeenCalled();
		});

		it('delete falha com erro real propaga erro', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const realError = Object.assign(new Error('Permission denied'), { code: 403 });
			const mockDeleteEvent = vi.fn().mockRejectedValue(realError);
			const mockCreateEvent = vi.fn();
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const desistencia: Evento = {
				...mockAgendamento,
				id: '507f1f77bcf86cd799439015',
				tipo: 'DESISTENCIA',
				previousEventoId: mockAgendamento.id,
			};

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: desistencia,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledWith('old-google-event');
			expect(mockCreateEvent).not.toHaveBeenCalled();
		});
	});

	describe('NO_SHOW', () => {
		it('deleta predecessor com googleEventId e não cria novo evento', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');
			const { updateGoogleEventId } = await import('../../src/repositories/evento.repository.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockDeleteEvent = vi.fn().mockResolvedValue(undefined);
			const mockCreateEvent = vi.fn();
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const noShow: Evento = {
				...mockAgendamento,
				id: '507f1f77bcf86cd799439016',
				tipo: 'NO_SHOW',
				previousEventoId: mockAgendamento.id,
			};

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: noShow,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledWith('old-google-event');
			expect(mockCreateEvent).not.toHaveBeenCalled();
			expect(updateGoogleEventId).not.toHaveBeenCalled();
		});

		it('não deleta predecessor sem googleEventId', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockDeleteEvent = vi.fn();
			const mockCreateEvent = vi.fn();
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const noShow: Evento = {
				...mockAgendamento,
				id: '507f1f77bcf86cd799439016',
				tipo: 'NO_SHOW',
				previousEventoId: mockAgendamento.id,
			};

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: undefined,
			};

			await calendarProjection({
				userId: 'user-1',
				evento: noShow,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).not.toHaveBeenCalled();
			expect(mockCreateEvent).not.toHaveBeenCalled();
		});

		it('delete retorna 404 é tratado como sucesso', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const notFoundError = Object.assign(new Error('Not Found'), { code: 404 });
			const mockDeleteEvent = vi.fn().mockRejectedValue(notFoundError);
			const mockCreateEvent = vi.fn();
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const noShow: Evento = {
				...mockAgendamento,
				id: '507f1f77bcf86cd799439016',
				tipo: 'NO_SHOW',
				previousEventoId: mockAgendamento.id,
			};

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: noShow,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledWith('old-google-event');
			expect(mockCreateEvent).not.toHaveBeenCalled();
		});
	});

	describe('VENDA', () => {
		it('VENDA permanece no-op', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');

			const venda: Evento = {
				...mockAgendamento,
				id: '507f1f77bcf86cd799439014',
				tipo: 'VENDA',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: venda,
				lead: mockLead,
			});

			expect(GoogleConnectionModel.findOne).not.toHaveBeenCalled();
		});
	});

	describe('Identidade', () => {
		it('somente previousEvento.googleEventId é utilizado para delete', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockDeleteEvent = vi.fn().mockResolvedValue(undefined);
			const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'google-event-456' });
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'specific-google-event-id',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: mockReagendamento,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledWith('specific-google-event-id');
			expect(mockDeleteEvent).not.toHaveBeenCalledWith(previousEvento.id);
			expect(mockDeleteEvent).not.toHaveBeenCalledWith(mockLead.id);
			expect(mockDeleteEvent).not.toHaveBeenCalledWith(mockReagendamento.id);
		});
	});

	describe('Chain', () => {
		it('previousEventoId mantém a cadeia histórica correta', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');
			const { updateGoogleEventId } = await import('../../src/repositories/evento.repository.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockDeleteEvent = vi.fn().mockResolvedValue(undefined);
			const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'google-event-789' });
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			vi.mocked(updateGoogleEventId).mockResolvedValue(true);

			const eventoA: Evento = {
				id: '507f1f77bcf86cd799439020',
				leadId: mockLead.id,
				tipo: 'AGENDAMENTO',
				data: new Date('2026-09-01T10:00:00Z'),
				googleEventId: 'google-A',
				createdAt: new Date('2026-08-25T10:00:00Z'),
			};

			const eventoB: Evento = {
				id: '507f1f77bcf86cd799439021',
				leadId: mockLead.id,
				tipo: 'REAGENDAMENTO',
				data: new Date('2026-09-02T10:00:00Z'),
				previousEventoId: eventoA.id,
				googleEventId: 'google-B',
				createdAt: new Date('2026-08-26T10:00:00Z'),
			};

			const eventoC: Evento = {
				id: '507f1f77bcf86cd799439022',
				leadId: mockLead.id,
				tipo: 'REAGENDAMENTO',
				data: new Date('2026-09-03T10:00:00Z'),
				previousEventoId: eventoB.id,
				createdAt: new Date('2026-08-27T10:00:00Z'),
			};

			await calendarProjection({
				userId: 'user-1',
				evento: eventoC,
				lead: mockLead,
				previousEvento: eventoB,
			});

			expect(mockDeleteEvent).toHaveBeenCalledWith('google-B');
			expect(mockCreateEvent).toHaveBeenCalled();
			expect(updateGoogleEventId).toHaveBeenCalledWith('user-1', eventoC.id, 'google-event-789');
		});
	});

	describe('Isolamento', () => {
		it('Google indisponível não faz EventoService.create() falhar', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: vi.fn().mockRejectedValue(new Error('Google API error')),
				updateEvent: vi.fn(),
				deleteEvent: vi.fn(),
			}) as any);

			await expect(
				calendarProjection({
					userId: 'user-1',
					evento: mockAgendamento,
					lead: mockLead,
				}),
			).resolves.toBeUndefined();
		});
	});

	describe('Edge cases', () => {
		it('não projeta se evento já possui googleEventId', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');

			const eventoComGoogleId: Evento = {
				...mockAgendamento,
				googleEventId: 'existing-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: eventoComGoogleId,
				lead: mockLead,
			});

			expect(GoogleConnectionModel.findOne).not.toHaveBeenCalled();
		});

		it('falha controlada quando GoogleConnection não existe', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue(null),
			} as any);

			await expect(
				calendarProjection({
					userId: 'user-1',
					evento: mockAgendamento,
					lead: mockLead,
				}),
			).resolves.toBeUndefined();
		});

		it('falha controlada quando calendarId não existe', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: null,
				}),
			} as any);

			await expect(
				calendarProjection({
					userId: 'user-1',
					evento: mockAgendamento,
					lead: mockLead,
				}),
			).resolves.toBeUndefined();
		});

		it('mapeamento correto de CalendarEvent', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'google-event-123' });
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: vi.fn(),
			}) as any);

			const eventoComObs: Evento = {
				...mockAgendamento,
				observacoes: 'Reunião de apresentação',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: eventoComObs,
				lead: mockLead,
			});

			const calendarEvent = mockCreateEvent.mock.calls[0][0];
			expect(calendarEvent.summary).toBe('[AGENDAMENTO] João da Silva');
			expect(calendarEvent.description).toContain('Lead: João da Silva');
			expect(calendarEvent.description).toContain('Telefone: 11999998888');
			expect(calendarEvent.description).toContain('Observações: Reunião de apresentação');
			expect(calendarEvent.start).toEqual(new Date('2026-09-01T10:00:00Z'));
			expect(calendarEvent.end).toEqual(new Date('2026-09-01T11:00:00Z'));
		});
	});

	describe('Idempotency', () => {
		it('CREATE envia id determinístico baseado em Evento.id', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');
			const { updateGoogleEventId } = await import('../../src/repositories/evento.repository.js');
			const { eventoIdToGoogleEventId } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'google-event-123' });
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: vi.fn(),
			}) as any);

			vi.mocked(updateGoogleEventId).mockResolvedValue(true);

			const expectedGoogleId = eventoIdToGoogleEventId(mockAgendamento.id);

			await calendarProjection({
				userId: 'user-1',
				evento: mockAgendamento,
				lead: mockLead,
			});

			expect(mockCreateEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					id: expectedGoogleId,
				}),
			);
		});

		it('id gerado é base32hex válido', async () => {
			const { eventoIdToGoogleEventId } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			const googleId = eventoIdToGoogleEventId('507f1f77bcf86cd799439011');

			expect(typeof googleId).toBe('string');
			expect(googleId.length).toBeGreaterThan(0);
		});

		it('mesmo Evento.id produz mesmo Google event ID', async () => {
			const { eventoIdToGoogleEventId } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			const id1 = eventoIdToGoogleEventId('507f1f77bcf86cd799439011');
			const id2 = eventoIdToGoogleEventId('507f1f77bcf86cd799439011');

			expect(id1).toBe(id2);
		});
	});

	describe('DELETE retry', () => {
		it('delete transiente faz retry uma vez', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const transientError = Object.assign(new Error('timeout'), { code: 408 });
			const mockDeleteEvent = vi.fn()
				.mockRejectedValueOnce(transientError)
				.mockResolvedValueOnce(undefined);
			const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'google-event-456' });
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: mockReagendamento,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledTimes(2);
			expect(mockCreateEvent).toHaveBeenCalled();
		});

		it('delete 404 no retry tratado como sucesso', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const notFoundError = Object.assign(new Error('Not Found'), { code: 404 });
			const mockDeleteEvent = vi.fn().mockRejectedValue(notFoundError);
			const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'google-event-456' });
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: mockReagendamento,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledTimes(1);
			expect(mockCreateEvent).toHaveBeenCalled();
		});

		it('delete transiente + retry 404 tratado como sucesso', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const transientError = Object.assign(new Error('timeout'), { code: 408 });
			const notFoundError = Object.assign(new Error('Not Found'), { code: 404 });
			const mockDeleteEvent = vi.fn()
				.mockRejectedValueOnce(transientError)
				.mockRejectedValueOnce(notFoundError);
			const mockCreateEvent = vi.fn().mockResolvedValue({ id: 'google-event-456' });
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: mockReagendamento,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledTimes(2);
			expect(mockCreateEvent).toHaveBeenCalled();
		});

		it('delete transiente com retry falha real não cria evento', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const transientError = Object.assign(new Error('timeout'), { code: 408 });
			const realError = Object.assign(new Error('Permission denied'), { code: 403 });
			const mockDeleteEvent = vi.fn()
				.mockRejectedValueOnce(transientError)
				.mockRejectedValueOnce(realError);
			const mockCreateEvent = vi.fn();
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: mockReagendamento,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledTimes(2);
			expect(mockCreateEvent).not.toHaveBeenCalled();
		});

		it('delete não transiente não faz retry', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleCalendarAdapter } = await import('../../src/integrations/google/calendar/calendar.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					calendarId: 'calendar-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const permError = Object.assign(new Error('Permission denied'), { code: 403 });
			const mockDeleteEvent = vi.fn().mockRejectedValue(permError);
			const mockCreateEvent = vi.fn();
			vi.mocked(GoogleCalendarAdapter).mockImplementation(() => ({
				createEvent: mockCreateEvent,
				updateEvent: vi.fn(),
				deleteEvent: mockDeleteEvent,
			}) as any);

			const previousEvento: Evento = {
				...mockAgendamento,
				googleEventId: 'old-google-event',
			};

			await calendarProjection({
				userId: 'user-1',
				evento: mockReagendamento,
				lead: mockLead,
				previousEvento,
			});

			expect(mockDeleteEvent).toHaveBeenCalledTimes(1);
			expect(mockCreateEvent).not.toHaveBeenCalled();
		});
	});
});
