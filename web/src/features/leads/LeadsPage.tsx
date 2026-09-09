import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Pagination } from '../../components/ui.js';
import { Loading } from '../../components/Loading.js';
import { useApi } from '../../lib/use-api.js';
import type { LeadStatus } from '../../types/api.js';
import { fetchLeads } from './api.js';

const STATUS_OPTIONS: Array<'' | LeadStatus> = ['', 'AGENDADO', 'VENDIDO', 'PERDIDO', 'NO_SHOW', 'REAGENDADO'];

const PAGE_SIZE = 20;

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
				actions={
					<Link className="axis-btn" to="/leads/new">
						Novo lead
					</Link>
				}
			/>
			<Card title="Filtros">
				<form onSubmit={applyFilters}>
					<div className="axis-form-row">
						<label>
							Status{' '}
							<select value={status} onChange={(e) => setStatus(e.target.value as '' | LeadStatus)}>
								{STATUS_OPTIONS.map((option) => (
									<option key={option} value={option}>
										{option === '' ? 'Todos' : option}
									</option>
								))}
							</select>
						</label>
						<label>
							Telefone{' '}
							<input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 9…" />
						</label>
						<label>
							Nome{' '}
							<input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" />
						</label>
						<button type="submit" className="axis-btn secondary">
							Filtrar
						</button>
					</div>
				</form>
			</Card>
			{state.status === 'loading' || state.status === 'idle' ? (
				<Loading label="Carregando leads…" />
			) : state.status === 'error' ? (
				<ErrorState error={state.error} onRetry={state.reload} />
			) : state.data.total === 0 ? (
				<EmptyState message="Nenhum lead encontrado." />
			) : (
				<>
					<div className="axis-table-wrap">
						<table className="axis-table">
							<thead>
								<tr>
									<th>Nome</th>
									<th>Telefone</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody>
								{state.data.items.map((lead) => (
									<tr key={lead.id}>
										<td>
											<Link to={`/leads/${lead.id}`}>{lead.nome}</Link>
										</td>
										<td>{lead.telefone}</td>
										<td>{lead.status ? <Badge>{lead.status}</Badge> : '—'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<Pagination page={page} limit={PAGE_SIZE} total={state.data.total} onPage={setPage} />
				</>
			)}
		</>
	);
}
