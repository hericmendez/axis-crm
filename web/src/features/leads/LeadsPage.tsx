import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { PageHeader, EmptyState, ErrorState, Pagination, LoadingState } from '../../components/ui.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import { Badge } from '../../components/ui/badge.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.js';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '../../components/ui/select.js';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '../../components/ui/table.js';
import { useApi } from '../../lib/use-api.js';
import type { LeadStatus } from '../../types/api.js';
import { fetchLeads } from './api.js';

const STATUS_OPTIONS: Array<'' | LeadStatus> = ['', 'AGENDADO', 'VENDIDO', 'PERDIDO', 'NO_SHOW', 'REAGENDADO'];

const PAGE_SIZE = 20;

function statusVariant(status: LeadStatus): 'success' | 'destructive' | 'warning' | 'secondary' | 'default' {
	switch (status) {
		case 'VENDIDO':
			return 'success';
		case 'PERDIDO':
		case 'NO_SHOW':
			return 'destructive';
		case 'REAGENDADO':
		case 'AGENDADO':
			return 'warning';
		default:
			return 'secondary';
	}
}

export function LeadsPage() {
	const [status, setStatus] = useState<'' | LeadStatus>('');
	const [telefone, setTelefone] = useState('');
	const [nome, setNome] = useState('');
	const [applied, setApplied] = useState({ status: '', telefone: '', nome: '' });
	const [page, setPage] = useState(1);

	const state = useApi(
		() =>
			fetchLeads({
				...(applied.status ? { status: applied.status as LeadStatus } : {}),
				...(applied.telefone ? { telefone: applied.telefone } : {}),
				...(applied.nome ? { nome: applied.nome } : {}),
				page,
				limit: PAGE_SIZE,
			}),
		[applied, page],
	);

	function applyFilters(event: React.FormEvent) {
		event.preventDefault();
		setPage(1);
		setApplied({ status, telefone: telefone.trim(), nome: nome.trim() });
	}

	return (
		<>
			<PageHeader
				title="Leads"
				subtitle={state.status === 'success' ? `${state.data.total} lead(s)` : undefined}
				actions={
					<Button asChild>
						<Link to="/leads/new">
							<Plus aria-hidden="true" /> Novo lead
						</Link>
					</Button>
				}
			/>
			<Card className="mb-4">
				<CardHeader>
					<CardTitle className="text-sm">Filtros</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={applyFilters}>
						<div className="flex flex-wrap items-end gap-3">
							<div className="grid min-w-36 flex-1 gap-1.5">
								<Label htmlFor="leads-status">Status</Label>
								<Select value={status} onValueChange={(v) => setStatus(v as '' | LeadStatus)}>
									<SelectTrigger id="leads-status">
										<SelectValue placeholder="Todos" />
									</SelectTrigger>
									<SelectContent>
										{STATUS_OPTIONS.map((option) => (
											<SelectItem key={option} value={option}>
												{option === '' ? 'Todos' : option}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid min-w-36 flex-1 gap-1.5">
								<Label htmlFor="leads-telefone">Telefone</Label>
								<Input
									id="leads-telefone"
									value={telefone}
									onChange={(e) => setTelefone(e.target.value)}
									placeholder="(11) 9…"
								/>
							</div>
							<div className="grid min-w-36 flex-1 gap-1.5">
								<Label htmlFor="leads-nome">Nome</Label>
								<Input
									id="leads-nome"
									value={nome}
									onChange={(e) => setNome(e.target.value)}
									placeholder="Nome"
								/>
							</div>
							<Button type="submit" variant="secondary">
								<Search aria-hidden="true" /> Filtrar
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
			{state.status === 'loading' || state.status === 'idle' ? (
				<LoadingState label="Carregando leads…" rows={5} />
			) : state.status === 'error' ? (
				<ErrorState error={state.error} onRetry={state.reload} />
			) : state.data.total === 0 ? (
				<EmptyState
					message="Nenhum lead encontrado."
					action={
						<Button asChild variant="secondary">
							<Link to="/leads/new">Adicionar primeiro lead</Link>
						</Button>
					}
				/>
			) : (
				<>
					<div className="hidden md:block">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Nome</TableHead>
									<TableHead>Telefone</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{state.data.items.map((lead) => (
									<TableRow key={lead.id}>
										<TableCell>
											<Link to={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">
												{lead.nome}
											</Link>
										</TableCell>
										<TableCell className="tabular-nums">{lead.telefone}</TableCell>
										<TableCell>
											{lead.status ? <Badge variant={statusVariant(lead.status)}>{lead.status}</Badge> : '—'}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					<div className="grid gap-3 md:hidden">
						{state.data.items.map((lead) => (
							<Card key={lead.id}>
								<CardContent className="pt-6">
									<div className="flex items-start justify-between gap-2">
										<Link to={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">
											{lead.nome}
										</Link>
										{lead.status ? (
											<Badge variant={statusVariant(lead.status)}>{lead.status}</Badge>
										) : null}
									</div>
									<p className="mt-1 text-sm tabular-nums text-muted-foreground">{lead.telefone}</p>
								</CardContent>
							</Card>
						))}
					</div>
					<Pagination page={page} limit={PAGE_SIZE} total={state.data.total} onPage={setPage} />
				</>
			)}
		</>
	);
}
