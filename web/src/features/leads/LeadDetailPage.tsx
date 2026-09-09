import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../lib/api-client.js';
import { useApi, useMutation } from '../../lib/use-api.js';
import { Loading } from '../../components/Loading.js';
import { Badge, Card, ConfirmDialog, EmptyState, ErrorState, PageHeader } from '../../components/ui.js';
import { deleteLead, fetchLead, fetchLeadEventos } from './api.js';

function formatDate(value?: string): string {
	if (!value) return '—';
	return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function LeadDetailPage() {
	const { id = '' } = useParams();
	const navigate = useNavigate();
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const deletion = useMutation(deleteLead);

	const leadState = useApi(() => fetchLead(id), [id]);
	const eventosState = useApi(() => fetchLeadEventos(id), [id]);

	async function handleDelete() {
		const ok = await deletion.run(id);
		if (ok !== null) {
			navigate('/leads');
		}
	}

	if (leadState.status !== 'success') {
		return (
			<>
				<PageHeader title="Lead" />
				{leadState.status === 'error' ? (
					<ErrorState error={leadState.error} onRetry={leadState.reload} />
				) : (
					<Loading label="Carregando lead…" />
				)}
			</>
		);
	}

	const lead = leadState.data;

	return (
		<>
			<PageHeader
				title={lead.nome}
				actions={
					<>
						<Link className="axis-btn secondary" to={`/leads/${lead.id}/edit`} style={{ textDecoration: 'none' }}>
							Editar
						</Link>
						<button type="button" className="axis-btn danger" onClick={() => setConfirmingDelete(true)}>
							Excluir
						</button>
					</>
				}
			/>
			<div className="axis-cards">
				<Card title="Dados">
					<p>Telefone: {lead.telefone}</p>
					<p>Origem: {lead.contatoOrigem}</p>
					<p>Status: {lead.status ? <Badge>{lead.status}</Badge> : '—'}</p>
					{lead.email ? <p>Email: {lead.email}</p> : null}
					{lead.senioridade ? <p>Senioridade: {lead.senioridade}</p> : null}
					{typeof lead.renda === 'number' ? <p>Renda: {lead.renda}</p> : null}
					{lead.tipoFechamento ? <p>Fechamento: {lead.tipoFechamento}</p> : null}
					{lead.observacoes ? <p>Observações: {lead.observacoes}</p> : null}
					<p className="axis-muted">Criado em {formatDate(lead.createdAt)}</p>
				</Card>
			</div>
			<Card title="Eventos">
				{eventosState.status === 'error' ? (
					<ErrorState error={eventosState.error} onRetry={eventosState.reload} />
				) : eventosState.status !== 'success' ? (
					<Loading label="Carregando eventos…" />
				) : eventosState.data.length === 0 ? (
					<EmptyState message="Nenhum evento registrado para este lead." />
				) : (
					<div className="axis-table-wrap">
						<table className="axis-table">
							<thead>
								<tr>
									<th>Tipo</th>
									<th>Data</th>
									<th>Observações</th>
								</tr>
							</thead>
							<tbody>
								{eventosState.data.map((evento) => (
									<tr key={evento.id}>
										<td>
											<Badge>{evento.tipo}</Badge>
										</td>
										<td>{formatDate(evento.data)}</td>
										<td>{evento.observacoes ?? '—'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Card>
			{confirmingDelete ? (
				<ConfirmDialog
					title="Excluir lead"
					message={`Excluir "${lead.nome}" permanentemente? Esta ação não pode ser desfeita.`}
					confirmLabel="Excluir"
					pending={deletion.submitting}
					onCancel={() => setConfirmingDelete(false)}
					onConfirm={handleDelete}
				/>
			) : null}
			{deletion.error instanceof ApiError ? (
				<p className="axis-field-error" role="alert">
					{deletion.error.message}
				</p>
			) : null}
		</>
	);
}
