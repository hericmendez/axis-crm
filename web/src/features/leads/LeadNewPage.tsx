import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api-client.js';
import { useMutation } from '../../lib/use-api.js';
import { Field, PageHeader, SelectInput, SubmitButton, TextArea, TextInput } from '../../components/ui.js';
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
			<PageHeader title="Novo lead" />
			<form onSubmit={handleSubmit} noValidate>
				<div className="axis-form">
					<Field label="Nome" htmlFor="lead-nome">
						<TextInput
							id="lead-nome"
							value={nome}
							onChange={(e) => setNome(e.target.value)}
							required
							disabled={mutation.submitting}
						/>
					</Field>
					<Field label="Telefone" htmlFor="lead-telefone">
						<TextInput
							id="lead-telefone"
							value={telefone}
							onChange={(e) => setTelefone(e.target.value)}
							required
							disabled={mutation.submitting}
						/>
					</Field>
					<Field label="Origem do contato" htmlFor="lead-origem">
						<TextInput
							id="lead-origem"
							value={contatoOrigem}
							onChange={(e) => setContatoOrigem(e.target.value)}
							required
							disabled={mutation.submitting}
						/>
					</Field>
					<Field label="Email (opcional)" htmlFor="lead-email">
						<TextInput
							id="lead-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={mutation.submitting}
						/>
					</Field>
					<Field label="Status (opcional)" htmlFor="lead-status">
						<SelectInput
							id="lead-status"
							value={status}
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
							value={observacoes}
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
						<Link className="axis-btn secondary" to="/leads" style={{ textDecoration: 'none' }}>
							Cancelar
						</Link>
					</div>
				</div>
			</form>
		</>
	);
}
