import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../lib/api-client.js';
import { useApi, useMutation } from '../../lib/use-api.js';
import { Loading } from '../../components/Loading.js';
import { ErrorState, Field, PageHeader, SelectInput, SubmitButton, TextArea, TextInput } from '../../components/ui.js';
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
			<form onSubmit={handleSubmit} noValidate>
				<div className="axis-form">
					<Field label="Nome" htmlFor="lead-nome">
						<TextInput
							id="lead-nome"
							value={nomeValue}
							onChange={(e) => setNome(e.target.value)}
							required
							disabled={mutation.submitting}
						/>
					</Field>
					<Field label="Telefone (imutável)" htmlFor="lead-telefone">
						<TextInput id="lead-telefone" value={lead.telefone} disabled readOnly />
					</Field>
					<Field label="Email (opcional)" htmlFor="lead-email">
						<TextInput
							id="lead-email"
							type="email"
							value={emailValue}
							onChange={(e) => setEmail(e.target.value)}
							disabled={mutation.submitting}
						/>
					</Field>
					<Field label="Status" htmlFor="lead-status">
						<SelectInput
							id="lead-status"
							value={statusValue}
							onChange={(e) => setStatus(e.target.value as '' | LeadStatus)}
							disabled={mutation.submitting}
						>
							{STATUS_OPTIONS.map((option) => (
								<option key={option} value={option}>
									{option === '' ? '—' : option}
								</option>
							))}
						</SelectInput>
					</Field>
					<Field label="Observações (opcional)" htmlFor="lead-observacoes">
						<TextArea
							id="lead-observacoes"
							value={observacoesValue}
							onChange={(e) => setObservacoes(e.target.value)}
							disabled={mutation.submitting}
						/>
					</Field>
					{formError ? (
						<p className="axis-field-error" role="alert">
							{formError}
						</p>
					) : null}
					{backendError ? (
						<p className="axis-field-error" role="alert">
							{backendError}
						</p>
					) : null}
					<div className="axis-form-row">
						<SubmitButton disabled={mutation.submitting}>
							{mutation.submitting ? 'Salvando…' : 'Salvar'}
						</SubmitButton>
						<Link className="axis-btn secondary" to={`/leads/${id}`} style={{ textDecoration: 'none' }}>
							Cancelar
						</Link>
					</div>
				</div>
			</form>
		</>
	);
}
