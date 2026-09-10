import { Link } from 'react-router-dom';
import { TrendingUp, Users, BadgeDollarSign } from 'lucide-react';
import { PageHeader, EmptyState, ErrorState, LoadingState } from '../../components/ui.js';
import { Button } from '../../components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.js';
import { Badge } from '../../components/ui/badge.js';
import { Separator } from '../../components/ui/separator.js';
import { useApi } from '../../lib/use-api.js';
import { defaultPeriodo, fetchMetricas } from './api.js';

function formatPercent(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

function StatusRow({ label, total, max }: { label: string; total: number; max: number }) {
	return (
		<div className="grid gap-1">
			<div className="flex items-center justify-between text-sm">
				<span className="flex items-center gap-2">
					<Badge variant="secondary">{label}</Badge>
				</span>
				<span className="font-medium tabular-nums">{total}</span>
			</div>
			<div
				role="progressbar"
				aria-valuenow={total}
				aria-valuemin={0}
				aria-valuemax={Math.max(max, 1)}
				aria-label={`${label}: ${total}`}
				className="h-2 overflow-hidden rounded-full bg-muted"
			>
				<div
					className="h-full rounded-full bg-primary transition-[width] duration-300"
					style={{ width: `${max > 0 ? Math.round((total / max) * 100) : 0}%` }}
				/>
			</div>
		</div>
	);
}

export function DashboardPage() {
	const { de, ate } = defaultPeriodo();
	const state = useApi(() => fetchMetricas(de, ate), []);

	if (state.status === 'idle' || state.status === 'loading') {
		return (
			<>
				<PageHeader title="Dashboard" subtitle="Últimos 30 dias" />
				<LoadingState label="Carregando métricas…" rows={4} />
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
				<EmptyState
					message="Nenhum lead no período. Cadastre o primeiro lead para ver métricas."
					action={
						<Button asChild>
							<Link to="/leads/new">Adicionar primeiro lead</Link>
						</Button>
					}
				/>
			</>
		);
	}

	const maxStatus = Math.max(0, ...metricas.leadsPorStatus.map((i) => i.total));
	const maxTipo = Math.max(0, ...metricas.eventosPorTipo.map((i) => i.total));

	const cards = [
		{ title: 'Total de Leads', value: String(metricas.taxaConversao.totalLeads), hint: 'Últimos 30 dias', Icon: Users },
		{ title: 'Vendas', value: String(metricas.taxaConversao.vendidos), hint: 'Leads com status VENDIDO', Icon: BadgeDollarSign },
		{
			title: 'Conversão',
			value: formatPercent(metricas.taxaConversao.taxaConversao),
			hint: 'Vendas sobre o total de leads',
			Icon: TrendingUp,
		},
	];

	return (
		<>
			<PageHeader title="Dashboard" subtitle="Últimos 30 dias" />
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{cards.map(({ title, value, hint, Icon }) => (
					<Card key={title}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
							<Icon className="size-4 text-muted-foreground" aria-hidden="true" />
						</CardHeader>
						<CardContent>
							<div className="text-3xl font-bold tabular-nums">{value}</div>
							<p className="mt-1 text-xs text-muted-foreground">{hint}</p>
						</CardContent>
					</Card>
				))}
			</div>
			<div className="mt-4 grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Leads por status</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-3">
						{metricas.leadsPorStatus.map((item) => (
							<StatusRow key={item.status} label={item.status} total={item.total} max={maxStatus} />
						))}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Eventos por tipo</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-3">
						{metricas.eventosPorTipo.map((item) => (
							<StatusRow key={item.tipo} label={item.tipo} total={item.total} max={maxTipo} />
						))}
					</CardContent>
				</Card>
			</div>
			<Separator className="my-6" />
		</>
	);
}
