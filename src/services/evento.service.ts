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

export async function create(input: CreateEventoInput): Promise<Evento> {
	const lead = await leadRepository.findById(input.leadId);
	if (!lead) {
		throw new AppError(404, 'Lead não encontrado');
	}

	const dataEvento = input.data ?? new Date();
	const evento = await eventoRepository.create({
		...input,
		data: dataEvento,
	});

	const patch = buildPatch(evento.tipo, dataEvento);
	const updated = await leadRepository.updateById(input.leadId, patch);
	if (!updated) {
		logger.error({ eventoId: evento.id, leadId: input.leadId }, 'Evento criado mas falha ao atualizar lead');
		throw new AppError(500, 'Falha ao aplicar efeitos do evento no lead');
	}

	logger.info({ eventoId: evento.id, tipo: evento.tipo, leadId: input.leadId }, 'Evento registrado');
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
