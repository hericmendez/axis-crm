import { Card, EmptyState, ErrorState, PageHeader } from '../../components/ui.js';
import { Loading } from '../../components/Loading.js';
import { useApi } from '../../lib/use-api.js';
import { defaultPeriodo, fetchMetricas } from './api.js';

function formatPercent(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

export function DashboardPage() {
	const { de, ate } = defaultPeriodo();
	const state = useApi(() => fetchMetricas(de, ate), []);

	if (state.status === 'idle' || state.status === 'loading') {
		return (
			<>
				<PageHeader title="Dashboard" subtitle="Últimos 30 dias" />
				<Loading label="Carregando métricas…" />
			</>
		);
	}

	if (state.status === 'error') {
		return (
			<>
				<PageHeader title="Dashboard" subtitle="Últimos 30 dias" />
				<ErrorState error={state.error} onRetry={state.reload} />
			</>
		);
	}

	const metricas = state.data;
	if (metricas.taxaConversao.totalLeads === 0) {
		return (
			<>
				<PageHeader title="Dashboard" subtitle="Últimos 30 dias" />
				<EmptyState message="Nenhum lead no período. Cadastre o primeiro lead para ver métricas." />
			</>
		);
	}

	return (
		<>
			<PageHeader title="Dashboard" subtitle="Últimos 30 dias" />
			<div className="axis-cards">
				<Card title="Leads">
					<div className="axis-metric">{metricas.taxaConversao.totalLeads}</div>
				</Card>
				<Card title="Vendas">
					<div className="axis-metric">{metricas.taxaConversao.vendidos}</div>
				</Card>
				<Card title="Conversão">
					<div className="axis-metric">{formatPercent(metricas.taxaConversao.taxaConversao)}</div>
				</Card>
			</div>
			<div className="axis-cards">
				<Card title="Leads por status">
					<ul>
						{metricas.leadsPorStatus.map((item) => (
							<li key={item.status}>
								{item.status}: {item.total}
							</li>
						))}
					</ul>
				</Card>
				<Card title="Eventos por tipo">
					<ul>
						{metricas.eventosPorTipo.map((item) => (
							<li key={item.tipo}>
								{item.tipo}: {item.total}
							</li>
						))}
					</ul>
				</Card>
			</div>
		</>
	);
}
