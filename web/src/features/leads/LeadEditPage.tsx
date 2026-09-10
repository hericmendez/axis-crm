import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../lib/api-client.js';
import { useApi, useMutation } from '../../lib/use-api.js';
import { Loading } from '../../components/Loading.js';
import { ErrorState, PageHeader } from '../../components/ui.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import { Alert, AlertDescription } from '../../components/ui/alert.js';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '../../components/ui/select.js';
import { Card, CardContent } from '../../components/ui/card.js';
import type { LeadStatus } from '../../types/api.js';
import { fetchLead, updateLead } from './api.js';

const STATUS_OPTIONS: Array<'' | LeadStatus> = ['', 'AGENDADO', 'VENDIDO', 'PERDIDO', 'NO_SHOW', 'REAGENDADO'];

export function LeadEditPage() {
	const { id = '' } = useParams();
	const navigate = useNavigate();
	const leadState = useApi(() => fetchLead(id), [id]);
	const mutation = useMutation((patch: Parameters<typeof updateLead>[1]) => updateLead(id, patch));

	const [nome, setNome] = useState<string | null>(null);
	const [email, setEmail] = useState<string | null>(null);
	const [status, setStatus] = useState<'' | LeadStatus | null>(null);
	const [observacoes, setObservacoes] = useState<string | null>(null);
	const [formError, setFormError] = useState<string | null>(null);

	if (leadState.status !== 'success') {
		return (
			<>
				<PageHeader title="Editar lead" />
				{leadState.status === 'error' ? (
					<ErrorState error={leadState.error} onRetry={leadState.reload} />
				) : (
					<Loading label="Carregando lead…" />
				)}
			</>
		);
	}

	const lead = leadState.data;
	const nomeValue = nome ?? lead.nome;
	const emailValue = email ?? lead.email ?? '';
	const statusValue = status ?? lead.status ?? '';
	const observacoesValue = observacoes ?? lead.observacoes ?? '';

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!nomeValue.trim()) {
			setFormError('Nome é obrigatório.');
			return;
		}
		const updated = await mutation.run({
			nome: nomeValue.trim(),
			...(emailValue.trim() ? { email: emailValue.trim() } : {}),
			...(statusValue ? { status: statusValue } : {}),
			...(observacoesValue.trim() ? { observacoes: observacoesValue.trim() } : {}),
		});
		if (updated) {
			navigate(`/leads/${id}`);
		}
	}

	const backendError = mutation.error instanceof ApiError ? mutation.error.message : null;

	return (
		<>
			<PageHeader title={`Editar ${lead.nome}`} />
			<Card className="max-w-2xl">
				<CardContent className="pt-6">
					<form onSubmit={handleSubmit} noValidate className="grid gap-4">
						<div className="grid gap-1.5">
							<Label htmlFor="lead-nome">Nome</Label>
							<Input
								id="lead-nome"
								value={nomeValue}
								onChange={(e) => setNome(e.target.value)}
								required
								disabled={mutation.submitting}
							/>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="lead-telefone">Telefone (imutável)</Label>
							<Input id="lead-telefone" value={lead.telefone} disabled readOnly />
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="grid gap-1.5">
								<Label htmlFor="lead-email">Email (opcional)</Label>
								<Input
									id="lead-email"
									type="email"
									value={emailValue}
									onChange={(e) => setEmail(e.target.value)}
									disabled={mutation.submitting}
								/>
							</div>
							<div className="grid gap-1.5">
								<Label htmlFor="lead-status">Status</Label>
								<Select value={statusValue} onValueChange={(v) => setStatus(v as '' | LeadStatus)}>
									<SelectTrigger id="lead-status" disabled={mutation.submitting}>
										<SelectValue placeholder="—" />
									</SelectTrigger>
									<SelectContent>
										{STATUS_OPTIONS.map((option) => (
											<SelectItem key={option} value={option}>
												{option === '' ? '—' : option}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="lead-observacoes">Observações (opcional)</Label>
							<textarea
								id="lead-observacoes"
								value={observacoesValue}
								onChange={(e) => setObservacoes(e.target.value)}
								disabled={mutation.submitting}
								rows={3}
								className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
							/>
						</div>
						{formError ? (
							<Alert variant="destructive">
								<AlertDescription>{formError}</AlertDescription>
							</Alert>
						) : null}
						{backendError ? (
							<Alert variant="destructive">
								<AlertDescription>{backendError}</AlertDescription>
							</Alert>
						) : null}
						<div className="flex flex-wrap gap-2">
							<Button type="submit" disabled={mutation.submitting}>
								{mutation.submitting ? 'Salvando…' : 'Salvar'}
							</Button>
							<Button type="button" variant="outline" asChild>
								<Link to={`/leads/${id}`}>Cancelar</Link>
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</>
	);
}
