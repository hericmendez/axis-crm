import type { Evento, EventoTipo } from '../../../types/evento.js';
import type { Lead } from '../../../types/lead.js';
import type { ICalendarAdapter } from './calendar.interface.js';
import type { CalendarEvent } from './calendar.types.js';
import { GoogleConnectionModel } from '../../../models/google-connection.model.js';
import { createOAuthUserProvider } from '../oauth-user-auth-provider.js';
import { GoogleCalendarAdapter, eventoIdToGoogleEventId } from './calendar.adapter.js';
import * as eventoRepository from '../../../repositories/evento.repository.js';
import { logger } from '../../../utils/logger.js';

const TIPOS_QUE_PROJETAM: EventoTipo[] = ['AGENDAMENTO', 'REAGENDAMENTO'];
const TIPOS_QUE_DELETAM_PREDECESSOR: EventoTipo[] = ['REAGENDAMENTO', 'DESISTENCIA', 'NO_SHOW'];

export interface CalendarProjectionInput {
	userId: string;
	evento: Evento;
	lead: Lead;
	previousEvento?: Evento | null;
}

function mapToCalendarEvent(evento: Evento, lead: Lead): CalendarEvent {
	const leadInfo = [
		`Lead: ${lead.nome}`,
		`Telefone: ${lead.telefone}`,
		...(evento.observacoes ? [`Observações: ${evento.observacoes}`] : []),
	].join('\n');

	const endTime = new Date(evento.data);
	endTime.setHours(endTime.getHours() + 1);

	return {
		id: eventoIdToGoogleEventId(evento.id),
		summary: `[${evento.tipo}] ${lead.nome}`,
		description: leadInfo,
		start: evento.data,
		end: endTime,
	};
}

function isNotFound(err: unknown): boolean {
	return err instanceof Error && 'code' in err && (err as { code: number }).code === 404;
}

function isTransientError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	const code = 'code' in err ? (err as { code: number }).code : undefined;
	if (code === 429) return true;
	if (code === 408) return true;
	if (typeof code === 'number' && code >= 500) return true;
	if (code === undefined && ('ECONNRESET' in err || 'ETIMEDOUT' in err || 'ENOTFOUND' in err)) return true;
	return false;
}

async function deletePreviousEvent(
	calendarAdapter: ICalendarAdapter,
	previousEvento: Evento,
): Promise<boolean> {
	if (!previousEvento.googleEventId) {
		return true;
	}

	try {
		await calendarAdapter.deleteEvent(previousEvento.googleEventId);
		logger.info(
			{ previousEventoId: previousEvento.id, googleEventId: previousEvento.googleEventId },
			'Previous Google Calendar event deleted',
		);
		return true;
	} catch (err: unknown) {
		if (isNotFound(err)) {
			logger.debug(
				{ previousEventoId: previousEvento.id, googleEventId: previousEvento.googleEventId },
				'Previous Google Calendar event already deleted (404), treating as success',
			);
			return true;
		}

		if (isTransientError(err)) {
			logger.warn(
				{ err, previousEventoId: previousEvento.id, googleEventId: previousEvento.googleEventId },
				'Transient error deleting previous event, retrying once',
			);
			try {
				await calendarAdapter.deleteEvent(previousEvento.googleEventId);
				logger.info(
					{ previousEventoId: previousEvento.id, googleEventId: previousEvento.googleEventId },
					'Previous Google Calendar event deleted on retry',
				);
				return true;
			} catch (retryErr: unknown) {
				if (isNotFound(retryErr)) {
					logger.debug(
						{ previousEventoId: previousEvento.id, googleEventId: previousEvento.googleEventId },
						'Previous Google Calendar event already deleted on retry (404), treating as success',
					);
					return true;
				}
				logger.error(
					{ err: retryErr, previousEventoId: previousEvento.id, googleEventId: previousEvento.googleEventId },
					'Failed to delete previous Google Calendar event after retry',
				);
				return false;
			}
		}

		logger.error(
			{ err, previousEventoId: previousEvento.id, googleEventId: previousEvento.googleEventId },
			'Failed to delete previous Google Calendar event',
		);
		return false;
	}
}

export async function calendarProjection(input: CalendarProjectionInput): Promise<void> {
	const { userId, evento, lead, previousEvento } = input;

	if (evento.googleEventId) {
		logger.debug(
			{ eventoId: evento.id, googleEventId: evento.googleEventId },
			'Evento already has googleEventId, skipping projection',
		);
		return;
	}

	const needsDelete = TIPOS_QUE_DELETAM_PREDECESSOR.includes(evento.tipo);
	const needsCreate = TIPOS_QUE_PROJETAM.includes(evento.tipo);

	if (!needsDelete && !needsCreate) {
		logger.debug(
			{ eventoId: evento.id, tipo: evento.tipo },
			'Evento type does not require Calendar projection, skipping',
		);
		return;
	}

	try {
		const connection = await GoogleConnectionModel.findOne({ userId }).lean();
		if (!connection) {
			logger.warn(
				{ userId, eventoId: evento.id },
				'No Google connection found for user, projection skipped',
			);
			return;
		}

		if (!connection.calendarId) {
			logger.warn(
				{ userId, eventoId: evento.id, connectionId: connection.id },
				'Google connection has no calendarId, projection skipped',
			);
			return;
		}

		const provider = createOAuthUserProvider(userId);
		const calendarAdapter: ICalendarAdapter = new GoogleCalendarAdapter(provider, connection.calendarId);

		if (needsDelete && previousEvento) {
			const deleteSuccess = await deletePreviousEvent(calendarAdapter, previousEvento);
			if (!deleteSuccess) {
				logger.error(
					{ eventoId: evento.id, tipo: evento.tipo, previousEventoId: previousEvento.id },
					'Failed to delete previous event, projection aborted',
				);
				return;
			}
		}

		if (!needsCreate) {
			logger.debug(
				{ eventoId: evento.id, tipo: evento.tipo },
				'Evento type does not generate Calendar event, projection completed',
			);
			return;
		}

		const calendarEvent = mapToCalendarEvent(evento, lead);
		const result = await calendarAdapter.createEvent(calendarEvent);

		await eventoRepository.updateGoogleEventId(evento.id, result.id);

		logger.info(
			{
				eventoId: evento.id,
				leadId: lead.id,
				userId,
				tipo: evento.tipo,
				googleEventId: result.id,
			},
			'Calendar projection completed',
		);
	} catch (err) {
		logger.error(
			{ err, eventoId: evento.id, leadId: lead.id, userId, tipo: evento.tipo, operation: 'calendarProjection' },
			'Calendar projection failed',
		);
	}
}
