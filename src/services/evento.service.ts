import type {
	CreateEventoInput,
	Evento,
	EventoTipo,
	Periodo,
} from '../types/evento.js';
import { AppError } from '../utils/errors.js';
import * as leadRepository from '../repositories/lead.repository.js';
import { logger } from '../utils/logger.js';
import * as eventoRepository from '../repositories/evento.repository.js';
import { calendarProjection } from '../integrations/google/calendar/calendar.projection.js';
import { sheetsProjection } from '../integrations/google/sheets/sheets.projection.js';

type LeadPatch = Parameters<typeof leadRepository.updateById>[1];

const EFEITO_NO_LEAD: Record<EventoTipo, LeadPatch> = {
	AGENDAMENTO: {},
	REAGENDAMENTO: { status: 'REAGENDADO' },
	VENDA: { status: 'VENDIDO' },
	DESISTENCIA: { status: 'PERDIDO' },
	NO_SHOW: { status: 'NO_SHOW' },
};

function buildPatch(tipo: EventoTipo, dataEvento: Date): LeadPatch {
	const base = EFEITO_NO_LEAD[tipo];
	switch (tipo) {
		case 'AGENDAMENTO':
		case 'REAGENDAMENTO':
			return { ...base, dataAgendamento: dataEvento };
		case 'VENDA':
			return { ...base, dataConversao: dataEvento };
		default:
			return base;
	}
}

const TIPOS_COM_PREDECESSOR: EventoTipo[] = ['REAGENDAMENTO', 'DESISTENCIA', 'NO_SHOW'];

async function resolvePreviousEvento(
	leadId: string,
	tipo: EventoTipo,
): Promise<string | undefined> {
	if (!TIPOS_COM_PREDECESSOR.includes(tipo)) {
		return undefined;
	}

	const activeEvento = await eventoRepository.findLastActiveForLead(leadId);

	if (!activeEvento) {
		throw new AppError(
			400,
			`Não há agendamento ativo para este lead. Não é possível registrar ${tipo}.`,
		);
	}

	return activeEvento.id;
}

export async function create(input: CreateEventoInput): Promise<Evento> {
	const lead = await leadRepository.findById(input.leadId);
	if (!lead) {
		throw new AppError(404, 'Lead não encontrado');
	}

	const previousEventoId = await resolvePreviousEvento(input.leadId, input.tipo);

	const dataEvento = input.data ?? new Date();
	const evento = await eventoRepository.create({
		...input,
		data: dataEvento,
		...(previousEventoId ? { previousEventoId } : {}),
	});

	const patch = buildPatch(evento.tipo, dataEvento);
	const updated = await leadRepository.updateById(input.leadId, patch);
	if (!updated) {
		const compensated = await eventoRepository.deleteById(evento.id);
		logger.error(
			{ eventoId: evento.id, leadId: input.leadId, compensado: compensated },
			'Falha ao aplicar efeitos do evento no lead',
		);
		throw new AppError(500, 'Falha ao aplicar efeitos do evento no lead');
	}

	logger.info({ eventoId: evento.id, tipo: evento.tipo, leadId: input.leadId }, 'Evento registrado');

	try {
		let previousEvento: Evento | null = null;
		if (evento.previousEventoId) {
			previousEvento = await eventoRepository.findById(evento.previousEventoId);
		}

		await calendarProjection({
			userId: input.userId ?? '',
			evento,
			lead,
			previousEvento,
		});
	} catch (err) {
		logger.error(
			{ err, eventoId: evento.id, leadId: input.leadId, userId: input.userId, tipo: evento.tipo, operation: 'calendarProjection' },
			'Calendar projection failed, domain result preserved',
		);
	}

	if (input.userId) {
		try {
			const updatedLead = await leadRepository.findById(input.leadId);
			if (updatedLead) {
				await sheetsProjection({ userId: input.userId, lead: updatedLead });
			}
		} catch (err) {
			logger.error(
				{ err, leadId: input.leadId, userId: input.userId, operation: 'sheetsProjection' },
				'Sheets projection failed, domain result preserved',
			);
		}
	}

	return evento;
}

export async function listByLead(leadId: string): Promise<Evento[]> {
	const lead = await leadRepository.findById(leadId);
	if (!lead) {
		throw new AppError(404, 'Lead não encontrado');
	}
	return eventoRepository.findByLeadId(leadId);
}

export async function countByTipoInPeriod(periodo: Periodo) {
	return eventoRepository.countByTipoInPeriod(periodo);
}
