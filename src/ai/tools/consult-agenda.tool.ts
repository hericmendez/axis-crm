import type { InternalTool } from './internal-tool.js';
import type { AgendaEventoView, AgendaView } from '../../types/agenda.js';

export interface ConsultAgendaInput {
	de: Date;
	ate: Date;
	userId?: string;
}

export interface ConsultAgendaToolDeps {
	agendaService: {
		consultarAgenda: (userId: string | undefined, de: Date, ate: Date) => Promise<AgendaView>;
	};
}

function formatarEvento(evento: AgendaEventoView): string {
	const data = evento.inicio.toLocaleDateString('pt-BR');
	if (evento.allDay) {
		return `- ${evento.titulo} (${data}, dia inteiro)`;
	}
	const horas = String(evento.inicio.getHours()).padStart(2, '0');
	const minutos = String(evento.inicio.getMinutes()).padStart(2, '0');
	return `- ${evento.titulo} (${data} ${horas}:${minutos})`;
}

export function createConsultAgendaTool(deps: ConsultAgendaToolDeps): InternalTool<ConsultAgendaInput> {
	return {
		async execute(params) {
			const view = await deps.agendaService.consultarAgenda(params.userId, params.de, params.ate);
			if (view.eventos.length === 0) {
				return {
					type: 'SUCCESS',
					message: 'Nenhum agendamento encontrado para este período.',
				};
			}
			const lista = view.eventos.map(formatarEvento).join('\n');
			return {
				type: 'SUCCESS',
				message: `Agendamentos:\n${lista}`,
				data: view,
			};
		},
	};
}
