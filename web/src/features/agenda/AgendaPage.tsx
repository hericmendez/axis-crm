import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, Search } from 'lucide-react';
import { ApiError } from '../../lib/api-client.js';
import { useApi, useMutation } from '../../lib/use-api.js';
import { Loading } from '../../components/Loading.js';
import { PageHeader, EmptyState, ErrorState, ConfirmDialog } from '../../components/ui.js';
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
	Dialog,
	DialogContent,
	DialogFooter,
} from '../../components/ui/dialog.js';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '../../components/ui/table.js';
import { Alert, AlertDescription } from '../../components/ui/alert.js';
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
					<Button type="button" variant="secondary" onClick={() => setShowNew((v) => !v)}>
						<CalendarPlus aria-hidden="true" /> Novo agendamento
					</Button>
				}
			/>
			<Card className="mb-4">
				<CardHeader>
					<CardTitle className="text-sm">Período</CardTitle>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							setApplied({ de, ate });
						}}
					>
						<div className="flex flex-wrap items-end gap-3">
							<div className="grid gap-1.5">
								<Label htmlFor="agenda-de">De</Label>
								<Input id="agenda-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
							</div>
							<div className="grid gap-1.5">
								<Label htmlFor="agenda-ate">Até</Label>
								<Input id="agenda-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
							</div>
							<Button type="submit" variant="secondary">
								<Search aria-hidden="true" /> Buscar
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>

			{actionError ? (
				<Alert variant="destructive" className="mb-4">
					<AlertDescription>{actionError}</AlertDescription>
				</Alert>
			) : null}

			{showNew ? (
				<Card className="mb-4">
					<CardHeader>
						<CardTitle>Novo agendamento</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-4">
						<form onSubmit={searchLeads}>
							<div className="flex flex-wrap items-end gap-3">
								<div className="grid min-w-44 flex-1 gap-1.5">
									<Label htmlFor="agenda-busca-lead">Buscar lead</Label>
									<Input
										id="agenda-busca-lead"
										value={leadSearch}
										onChange={(e) => setLeadSearch(e.target.value)}
										placeholder="Nome"
									/>
								</div>
								<Button type="submit" variant="secondary">
									<Search aria-hidden="true" /> Buscar
								</Button>
							</div>
						</form>
						<form onSubmit={handleCreate} className="grid gap-4">
							<div className="grid gap-1.5">
								<Label htmlFor="agenda-lead">Lead</Label>
								<Select value={newLeadId} onValueChange={setNewLeadId}>
									<SelectTrigger id="agenda-lead" disabled={mutation.submitting}>
										<SelectValue placeholder="Selecione…" />
									</SelectTrigger>
									<SelectContent>
										{leadOptions.map((option) => (
											<SelectItem key={option.id} value={option.id}>
												{option.nome}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-1.5">
								<Label htmlFor="agenda-data">Data e hora</Label>
								<Input
									id="agenda-data"
									type="datetime-local"
									value={newData}
									onChange={(e) => setNewData(e.target.value)}
									disabled={mutation.submitting}
								/>
							</div>
							<div className="grid gap-1.5">
								<Label htmlFor="agenda-obs">Observações (opcional)</Label>
								<textarea
									id="agenda-obs"
									value={newObservacoes}
									onChange={(e) => setNewObservacoes(e.target.value)}
									disabled={mutation.submitting}
									rows={3}
									className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
								/>
							</div>
							<div>
								<Button type="submit" disabled={mutation.submitting}>
									{mutation.submitting ? 'Agendando…' : 'Agendar'}
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			) : null}

			{state.status === 'loading' || state.status === 'idle' ? (
				<Loading label="Carregando agenda…" />
			) : state.status === 'error' ? (
				<ErrorState error={state.error} onRetry={state.reload} />
			) : (
				<>
					{CALENDAR_STATUS_TEXT[state.data.calendarStatus] ? (
						<Alert variant="destructive" className="mb-4">
							<AlertDescription>{CALENDAR_STATUS_TEXT[state.data.calendarStatus]}</AlertDescription>
						</Alert>
					) : null}
					{state.data.eventos.length === 0 ? (
						<EmptyState message="Nenhum compromisso no período." />
					) : (
						<>
							<div className="hidden md:block">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Compromisso</TableHead>
											<TableHead>Início</TableHead>
											<TableHead>Fim</TableHead>
											<TableHead>Origem</TableHead>
											<TableHead>Ações</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{state.data.eventos.map((evento) => (
											<TableRow key={`${evento.origem}-${evento.id}`}>
												<TableCell>
													<span className="font-medium">{evento.titulo}</span>{' '}
													{evento.allDay ? <Badge variant="secondary">dia inteiro</Badge> : null}{' '}
													{evento.tipo ? <Badge variant="outline">{evento.tipo}</Badge> : null}
												</TableCell>
												<TableCell className="tabular-nums">{formatDateTime(evento.inicio)}</TableCell>
												<TableCell className="tabular-nums">
													{evento.allDay ? '—' : formatDateTime(evento.fim)}
												</TableCell>
												<TableCell>
													<Badge variant={evento.origem === 'domain' ? 'default' : 'secondary'}>
														{evento.origem === 'domain' ? 'Axis' : 'Google'}
													</Badge>
												</TableCell>
												<TableCell>
													<EventActions
														evento={evento}
														onReschedule={() => {
															setRescheduleTarget(evento);
															setNewDate(toDatetimeLocalValue(new Date(evento.inicio)));
														}}
														onCancel={() => setCancelTarget(evento)}
													/>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
							<div className="grid gap-3 md:hidden">
								{state.data.eventos.map((evento) => (
									<Card key={`${evento.origem}-${evento.id}`}>
										<CardContent className="pt-6">
											<div className="flex items-start justify-between gap-2">
												<span className="font-medium">{evento.titulo}</span>
												<Badge variant={evento.origem === 'domain' ? 'default' : 'secondary'}>
													{evento.origem === 'domain' ? 'Axis' : 'Google'}
												</Badge>
											</div>
											<p className="mt-1 text-sm tabular-nums text-muted-foreground">
												{formatDateTime(evento.inicio)}
												{evento.allDay ? ' · dia inteiro' : ` → ${formatDateTime(evento.fim)}`}
											</p>
											{evento.tipo ? (
												<p className="mt-2">
													<Badge variant="outline">{evento.tipo}</Badge>
												</p>
											) : null}
											<div className="mt-3">
												<EventActions
													evento={evento}
													onReschedule={() => {
														setRescheduleTarget(evento);
														setNewDate(toDatetimeLocalValue(new Date(evento.inicio)));
													}}
													onCancel={() => setCancelTarget(evento)}
												/>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</>
					)}
					<Card className="mt-4">
						<CardHeader>
							<CardTitle>Disponibilidade</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground">
								{state.data.disponibilidade.length} intervalo(s) livre(s) no período.
							</p>
						</CardContent>
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

			<Dialog open={rescheduleTarget !== null} onOpenChange={(open) => !open && setRescheduleTarget(null)}>
				<DialogContent aria-label="Reagendar compromisso">
					<form onSubmit={handleReschedule}>
						<div className="grid gap-1.5">
							<Label htmlFor="reagendar-data">Nova data e hora</Label>
							<Input
								id="reagendar-data"
								type="datetime-local"
								value={newDate}
								onChange={(e) => setNewDate(e.target.value)}
								disabled={mutation.submitting}
							/>
						</div>
						<DialogFooter className="mt-4">
							<Button
								type="button"
								variant="outline"
								onClick={() => setRescheduleTarget(null)}
								disabled={mutation.submitting}
							>
								Fechar
							</Button>
							<Button type="submit" disabled={mutation.submitting || !newDate}>
								{mutation.submitting ? 'Reagendando…' : 'Confirmar'}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}

function EventActions({
	evento,
	onReschedule,
	onCancel,
}: {
	evento: AgendaEventoView;
	onReschedule: () => void;
	onCancel: () => void;
}) {
	if (isActionable(evento) && evento.leadId) {
		return (
			<div className="flex flex-wrap gap-2">
				<Button type="button" variant="outline" size="sm" onClick={onReschedule}>
					Reagendar
				</Button>
				<Button type="button" variant="destructive" size="sm" onClick={onCancel}>
					Cancelar
				</Button>
			</div>
		);
	}
	if (evento.leadId) {
		return <Link to={`/leads/${evento.leadId}`}>Ver lead</Link>;
	}
	return <>—</>;
}
