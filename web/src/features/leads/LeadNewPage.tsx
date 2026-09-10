import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api-client.js';
import { useMutation } from '../../lib/use-api.js';
import { PageHeader } from '../../components/ui.js';
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
import { createLead } from './api.js';

const STATUS_OPTIONS: Array<'' | LeadStatus> = ['', 'AGENDADO', 'VENDIDO', 'PERDIDO', 'NO_SHOW', 'REAGENDADO'];

export function LeadNewPage() {
	const navigate = useNavigate();
	const [nome, setNome] = useState('');
	const [telefone, setTelefone] = useState('');
	const [contatoOrigem, setContatoOrigem] = useState('');
	const [email, setEmail] = useState('');
	const [status, setStatus] = useState<'' | LeadStatus>('');
	const [observacoes, setObservacoes] = useState('');
	const [formError, setFormError] = useState<string | null>(null);
	const mutation = useMutation(createLead);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!nome.trim() || !telefone.trim() || !contatoOrigem.trim()) {
			setFormError('Nome, telefone e origem do contato são obrigatórios.');
			return;
		}
		const created = await mutation.run({
			nome: nome.trim(),
			telefone: telefone.trim(),
			contatoOrigem: contatoOrigem.trim(),
			...(email.trim() ? { email: email.trim() } : {}),
			...(status ? { status } : {}),
			...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
		});
		if (created) {
			navigate(`/leads/${created.id}`);
		}
	}

	const backendError = mutation.error instanceof ApiError ? mutation.error.message : null;

	return (
		<>
			<PageHeader title="Novo lead" subtitle="Cadastre um contato comercial" />
			<Card className="max-w-2xl">
				<CardContent className="pt-6">
					<form onSubmit={handleSubmit} noValidate className="grid gap-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="grid gap-1.5">
								<Label htmlFor="lead-nome">Nome</Label>
								<Input
									id="lead-nome"
									value={nome}
									onChange={(e) => setNome(e.target.value)}
									required
									disabled={mutation.submitting}
								/>
							</div>
							<div className="grid gap-1.5">
								<Label htmlFor="lead-telefone">Telefone</Label>
								<Input
									id="lead-telefone"
									inputMode="tel"
									value={telefone}
									onChange={(e) => setTelefone(e.target.value)}
									required
									disabled={mutation.submitting}
								/>
							</div>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="grid gap-1.5">
								<Label htmlFor="lead-origem">Origem do contato</Label>
								<Input
									id="lead-origem"
									value={contatoOrigem}
									onChange={(e) => setContatoOrigem(e.target.value)}
									required
									disabled={mutation.submitting}
								/>
							</div>
							<div className="grid gap-1.5">
								<Label htmlFor="lead-email">Email (opcional)</Label>
								<Input
									id="lead-email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									disabled={mutation.submitting}
								/>
							</div>
						</div>
						<div className="grid gap-1.5">
							<Label htmlFor="lead-status">Status (opcional)</Label>
							<Select value={status} onValueChange={(v) => setStatus(v as '' | LeadStatus)}>
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
						<div className="grid gap-1.5">
							<Label htmlFor="lead-observacoes">Observações (opcional)</Label>
							<textarea
								id="lead-observacoes"
								value={observacoes}
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
								<Link to="/leads">Cancelar</Link>
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</>
	);
}
