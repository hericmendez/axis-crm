import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../lib/api-client.js';
import { useApi, useMutation } from '../../lib/use-api.js';
import { Loading } from '../../components/Loading.js';
import {
	Badge,
	Card,
	ConfirmDialog,
	EmptyState,
	ErrorState,
	Field,
	PageHeader,
	SelectInput,
	TextArea,
	TextInput,
} from '../../components/ui.js';
import type { AgendaEventoView, CalendarStatus } from '../../types/api.js';
import { createEvento, fetchAgenda, formatDateTime, toDateInputValue, toDatetimeLocalValue } from './api.js';
import { fetchLeads } from '../leads/api.js';

function defaultRange(): { de: string; ate: string } {
	const now = new Date();
	const ate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
	return { de: toDateInputValue(now), ate: toDateInputValue(ate) };
}

const CALENDAR_STATUS_TEXT: Record<CalendarStatus, string | null> = {
	OK: null,
	NO_CONNECTION: 'Google Calendar não conectado: mostrando apenas eventos do Axis.',
	NO_CALENDAR: 'Conta Google sem calendário configurado: mostrando apenas eventos do Axis.',
	UNAVAILABLE: 'Google Calendar indisponível no momento: mostrando apenas eventos do Axis.',
};

function isActionable(evento: AgendaEventoView): boolean {
	return evento.origem === 'domain' && (evento.tipo === 'AGENDAMENTO' || evento.tipo === 'REAGENDAMENTO');
}

export function AgendaPage() {
	const initial = defaultRange();
	const [de, setDe] = useState(initial.de);
	const [ate, setAte] = useState(initial.ate);
	const [applied, setApplied] = useState(initial);
	const [cancelTarget, setCancelTarget] = useState<AgendaEventoView | null>(null);
	const [rescheduleTarget, setRescheduleTarget] = useState<AgendaEventoView | null>(null);
	const [newDate, setNewDate] = useState('');
	const [actionError, setActionError] = useState<string | null>(null);

	const [showNew, setShowNew] = useState(false);
	const [leadSearch, setLeadSearch] = useState('');
	const [leadOptions, setLeadOptions] = useState<Array<{ id: string; nome: string }>>([]);
	const [newLeadId, setNewLeadId] = useState('');
	const [newData, setNewData] = useState('');
	const [newObservacoes, setNewObservacoes] = useState('');

	const state = useApi(() => fetchAgenda({ de: applied.de, ate: applied.ate }), [applied.de, applied.ate]);
	const mutation = useMutation(createEvento);

	async function refresh() {
		setCancelTarget(null);
		setRescheduleTarget(null);
		setActionError(null);
		state.reload();
	}

	async function handleCancel() {
		if (!cancelTarget?.leadId) return;
		const created = await mutation.run({
			leadId: cancelTarget.leadId,
			tipo: 'DESISTENCIA',
			eventoId: cancelTarget.id,
		});
		if (created) {
			await refresh();
		} else if (mutation.error instanceof ApiError) {
			setActionError(mutation.error.message);
		}
	}

	async function handleReschedule(event: React.FormEvent) {
		event.preventDefault();
		if (!rescheduleTarget?.leadId || !newDate) return;
		const created = await mutation.run({
			leadId: rescheduleTarget.leadId,
			tipo: 'REAGENDAMENTO',
			data: new Date(newDate).toISOString(),
			eventoId: rescheduleTarget.id,
		});
		if (created) {
			setNewDate('');
			await refresh();
		} else if (mutation.error instanceof ApiError) {
			setActionError(mutation.error.message);
		}
	}

	async function searchLeads(event: React.FormEvent) {
		event.preventDefault();
		try {
			const result = await fetchLeads({ nome: leadSearch.trim() || undefined, limit: 20 });
			setLeadOptions(result.items.map((lead) => ({ id: lead.id, nome: `${lead.nome} (${lead.telefone})` })));
			if (result.items.length > 0 && !newLeadId) {
				setNewLeadId(result.items[0]?.id ?? '');
			}
		} catch (err) {
			setActionError(err instanceof ApiError ? err.message : 'Falha ao buscar leads.');
		}
	}

	async function handleCreate(event: React.FormEvent) {
		event.preventDefault();
		if (!newLeadId || !newData) {
			setActionError('Selecione o lead e a data do agendamento.');
			return;
		}
		const created = await mutation.run({
			leadId: newLeadId,
			tipo: 'AGENDAMENTO',
			data: new Date(newData).toISOString(),
			...(newObservacoes.trim() ? { observacoes: newObservacoes.trim() } : {}),
		});
		if (created) {
			setShowNew(false);
			setNewData('');
			setNewObservacoes('');
			await refresh();
		} else if (mutation.error instanceof ApiError) {
			setActionError(mutation.error.message);
		}
	}

	return (
		<>
			<PageHeader
				title="Agenda"
				subtitle="Visão unificada Axis + Google Calendar"
				actions={
					<button type="button" className="axis-btn secondary" onClick={() => setShowNew((v) => !v)}>
						Novo agendamento
					</button>
				}
			/>
			<Card title="Período">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						setApplied({ de, ate });
					}}
				>
					<div className="axis-form-row">
						<label>
							De <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
						</label>
						<label>
							Até <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
						</label>
						<button type="submit" className="axis-btn secondary">
							Buscar
						</button>
					</div>
				</form>
			</Card>

			{actionError ? (
				<p className="axis-field-error" role="alert">
					{actionError}
				</p>
			) : null}

			{showNew ? (
				<Card title="Novo agendamento">
					<form onSubmit={searchLeads}>
						<div className="axis-form-row">
							<label>
								Buscar lead{' '}
								<input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Nome" />
							</label>
							<button type="submit" className="axis-btn secondary">
								Buscar
							</button>
						</div>
					</form>
					<form onSubmit={handleCreate}>
						<div className="axis-form" style={{ marginTop: '0.75rem' }}>
							<Field label="Lead" htmlFor="agenda-lead">
								<SelectInput
									id="agenda-lead"
									value={newLeadId}
									onChange={(e) => setNewLeadId(e.target.value)}
									disabled={mutation.submitting}
								>
									<option value="">Selecione…</option>
									{leadOptions.map((option) => (
										<option key={option.id} value={option.id}>
											{option.nome}
										</option>
									))}
								</SelectInput>
							</Field>
							<Field label="Data e hora" htmlFor="agenda-data">
								<TextInput
									id="agenda-data"
									type="datetime-local"
									value={newData}
									onChange={(e) => setNewData(e.target.value)}
									disabled={mutation.submitting}
								/>
							</Field>
							<Field label="Observações (opcional)" htmlFor="agenda-obs">
								<TextArea
									id="agenda-obs"
									value={newObservacoes}
									onChange={(e) => setNewObservacoes(e.target.value)}
									disabled={mutation.submitting}
								/>
							</Field>
							<div className="axis-form-row">
								<button type="submit" className="axis-btn" disabled={mutation.submitting}>
									{mutation.submitting ? 'Agendando…' : 'Agendar'}
								</button>
							</div>
						</div>
					</form>
				</Card>
			) : null}

			{state.status === 'loading' || state.status === 'idle' ? (
				<Loading label="Carregando agenda…" />
			) : state.status === 'error' ? (
				<ErrorState error={state.error} onRetry={state.reload} />
			) : (
				<>
					{CALENDAR_STATUS_TEXT[state.data.calendarStatus] ? (
						<p className="axis-field-error" role="status">
							{CALENDAR_STATUS_TEXT[state.data.calendarStatus]}
						</p>
					) : null}
					{state.data.eventos.length === 0 ? (
						<EmptyState message="Nenhum compromisso no período." />
					) : (
						<div className="axis-table-wrap">
							<table className="axis-table">
								<thead>
									<tr>
										<th>Compromisso</th>
										<th>Início</th>
										<th>Fim</th>
										<th>Origem</th>
										<th>Ações</th>
									</tr>
								</thead>
								<tbody>
									{state.data.eventos.map((evento) => (
										<tr key={`${evento.origem}-${evento.id}`}>
											<td>
												{evento.titulo}
												{evento.allDay ? <Badge>dia inteiro</Badge> : null}{' '}
												{evento.tipo ? <Badge>{evento.tipo}</Badge> : null}
											</td>
											<td>{formatDateTime(evento.inicio)}</td>
											<td>{evento.allDay ? '—' : formatDateTime(evento.fim)}</td>
											<td>
												<Badge tone={evento.origem === 'domain' ? 'info' : undefined}>
													{evento.origem === 'domain' ? 'Axis' : 'Google'}
												</Badge>
											</td>
											<td>
												{isActionable(evento) && evento.leadId ? (
													<>
														<button
															type="button"
															className="axis-btn secondary"
															onClick={() => {
																setRescheduleTarget(evento);
																setNewDate(toDatetimeLocalValue(new Date(evento.inicio)));
															}}
														>
															Reagendar
														</button>{' '}
														<button
															type="button"
															className="axis-btn danger"
															onClick={() => setCancelTarget(evento)}
														>
															Cancelar
														</button>
													</>
												) : evento.leadId ? (
													<Link to={`/leads/${evento.leadId}`}>Ver lead</Link>
												) : (
													'—'
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					<Card title="Disponibilidade">
						<p>
							{state.data.disponibilidade.length} intervalo(s) livre(s) no período.
						</p>
					</Card>
				</>
			)}

			{cancelTarget ? (
				<ConfirmDialog
					title="Cancelar compromisso"
					message={`Cancelar "${cancelTarget.titulo}" em ${formatDateTime(cancelTarget.inicio)}?`}
					confirmLabel="Cancelar compromisso"
					pending={mutation.submitting}
					onCancel={() => setCancelTarget(null)}
					onConfirm={handleCancel}
				/>
			) : null}

			{rescheduleTarget ? (
				<div className="axis-dialog-backdrop">
					<div className="axis-dialog" role="dialog" aria-modal="true" aria-label="Reagendar compromisso">
						<h2>Reagendar</h2>
						<form onSubmit={handleReschedule}>
							<Field label="Nova data e hora" htmlFor="reagendar-data">
								<TextInput
									id="reagendar-data"
									type="datetime-local"
									value={newDate}
									onChange={(e) => setNewDate(e.target.value)}
									disabled={mutation.submitting}
								/>
							</Field>
							<div className="axis-form-row" style={{ justifyContent: 'flex-end', marginTop: '0.75rem' }}>
								<button
									type="button"
									className="axis-btn secondary"
									onClick={() => setRescheduleTarget(null)}
									disabled={mutation.submitting}
								>
									Fechar
								</button>
								<button type="submit" className="axis-btn" disabled={mutation.submitting || !newDate}>
									{mutation.submitting ? 'Reagendando…' : 'Confirmar'}
								</button>
							</div>
						</form>
					</div>
				</div>
			) : null}
		</>
	);
}
