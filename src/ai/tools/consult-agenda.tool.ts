import type { InternalTool } from './internal-tool.js';

export interface ConsultAgendaInput {
	de: Date;
	ate: Date;
}

export interface ConsultAgendaToolDeps {
	metricasService: {
		agenda: (de: Date, ate: Date) => Promise<unknown[]>;
	};
}

export function createConsultAgendaTool(deps: ConsultAgendaToolDeps): InternalTool<ConsultAgendaInput> {
	return {
		async execute(params) {
			const items = await deps.metricasService.agenda(params.de, params.ate);
			if (items.length === 0) {
				return {
					type: 'SUCCESS',
					message: 'Nenhum agendamento encontrado para este período.',
				};
			}
			const lista = items
				.map((item: unknown) => {
					const i = item as { nome?: string; dataAgendamento?: Date };
					return `- ${i.nome ?? 'Sem nome'} (${i.dataAgendamento ? new Date(i.dataAgendamento).toLocaleDateString('pt-BR') : 's/data'})`;
				})
				.join('\n');
			return {
				type: 'SUCCESS',
				message: `Agendamentos:\n${lista}`,
				data: items,
			};
		},
	};
}
