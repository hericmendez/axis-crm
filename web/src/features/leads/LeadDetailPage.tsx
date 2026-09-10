import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { ApiError } from '../../lib/api-client.js';
import { useApi, useMutation } from '../../lib/use-api.js';
import { Loading } from '../../components/Loading.js';
import { PageHeader, EmptyState, ErrorState, ConfirmDialog } from '../../components/ui.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.js';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '../../components/ui/table.js';
import { Alert, AlertDescription } from '../../components/ui/alert.js';
import type { LeadStatus } from '../../types/api.js';
import { deleteLead, fetchLead, fetchLeadEventos } from './api.js';

function formatDate(value?: string): string {
	if (!value) return '—';
	return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="grid grid-cols-[10rem_1fr] gap-2 text-sm">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="m-0 break-words">{children}</dd>
		</div>
	);
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
				subtitle={lead.status ? undefined : 'Sem status'}
				actions={
					<>
						<Button variant="outline" asChild>
							<Link to={`/leads/${lead.id}/edit`}>
								<Pencil aria-hidden="true" /> Editar
							</Link>
						</Button>
						<Button variant="destructive" onClick={() => setConfirmingDelete(true)}>
							<Trash2 aria-hidden="true" /> Excluir
						</Button>
					</>
				}
			/>
			{lead.status ? (
				<p>
					<Badge variant={statusVariant(lead.status)}>{lead.status}</Badge>
				</p>
			) : null}
			<div className="mt-4 grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Dados</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="grid gap-2">
							<DetailRow label="Telefone">
								<span className="tabular-nums">{lead.telefone}</span>
							</DetailRow>
							<DetailRow label="Origem">{lead.contatoOrigem}</DetailRow>
							{lead.email ? <DetailRow label="Email">{lead.email}</DetailRow> : null}
							{lead.senioridade ? <DetailRow label="Senioridade">{lead.senioridade}</DetailRow> : null}
							{typeof lead.renda === 'number' ? <DetailRow label="Renda">{lead.renda}</DetailRow> : null}
							{lead.tipoFechamento ? <DetailRow label="Fechamento">{lead.tipoFechamento}</DetailRow> : null}
							{lead.observacoes ? <DetailRow label="Observações">{lead.observacoes}</DetailRow> : null}
							<DetailRow label="Criado em">
								<span className="text-muted-foreground">{formatDate(lead.createdAt)}</span>
							</DetailRow>
						</dl>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Eventos</CardTitle>
					</CardHeader>
					<CardContent>
						{eventosState.status === 'error' ? (
							<ErrorState error={eventosState.error} onRetry={eventosState.reload} />
						) : eventosState.status !== 'success' ? (
							<Loading label="Carregando eventos…" />
						) : eventosState.data.length === 0 ? (
							<EmptyState message="Nenhum evento registrado para este lead." />
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Tipo</TableHead>
										<TableHead>Data</TableHead>
										<TableHead>Observações</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{eventosState.data.map((evento) => (
										<TableRow key={evento.id}>
											<TableCell>
												<Badge variant="secondary">{evento.tipo}</Badge>
											</TableCell>
											<TableCell className="tabular-nums">{formatDate(evento.data)}</TableCell>
											<TableCell>{evento.observacoes ?? '—'}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>
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
				<Alert variant="destructive" className="mt-4">
					<AlertDescription>{deletion.error.message}</AlertDescription>
				</Alert>
			) : null}
		</>
	);
}
