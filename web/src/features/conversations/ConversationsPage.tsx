import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader, EmptyState, ErrorState, Pagination, LoadingState } from '../../components/ui.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import { Card, CardContent } from '../../components/ui/card.js';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '../../components/ui/table.js';
import { useApi } from '../../lib/use-api.js';
import { fetchConversas } from './api.js';

const PAGE_SIZE = 20;

function formatDateTime(value: string): string {
	return new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function ConversationsPage() {
	const [chatIdExterno, setChatIdExterno] = useState('');
	const [applied, setApplied] = useState('');
	const [page, setPage] = useState(1);

	const state = useApi(
		() =>
			fetchConversas({
				...(applied ? { chatIdExterno: applied } : {}),
				page,
				limit: PAGE_SIZE,
			}),
		[applied, page],
	);

	return (
		<>
			<PageHeader title="Conversas" subtitle="Histórico do WhatsApp (somente leitura)" />
			<Card className="mb-4">
				<CardContent className="pt-6">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							setPage(1);
							setApplied(chatIdExterno.trim());
						}}
					>
						<div className="flex flex-wrap items-end gap-3">
							<div className="grid min-w-52 flex-1 gap-1.5">
								<Label htmlFor="conversas-chat">Chat externo</Label>
								<Input
									id="conversas-chat"
									value={chatIdExterno}
									onChange={(e) => setChatIdExterno(e.target.value)}
									placeholder="5511…@c.us"
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
				<LoadingState label="Carregando conversas…" rows={4} />
			) : state.status === 'error' ? (
				<ErrorState error={state.error} onRetry={state.reload} />
			) : state.data.total === 0 ? (
				<EmptyState message="Nenhuma conversa encontrada." />
			) : (
				<>
					<div className="hidden md:block">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Chat</TableHead>
									<TableHead>Canal</TableHead>
									<TableHead>Lead</TableHead>
									<TableHead>Atualizada em</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{state.data.items.map((conversa) => (
									<TableRow key={conversa.id}>
										<TableCell>
											<Link to={`/conversations/${conversa.id}`} className="font-medium text-primary hover:underline">
												{conversa.chatIdExterno}
											</Link>
										</TableCell>
										<TableCell>
											<Badge variant="secondary">{conversa.canal}</Badge>
										</TableCell>
										<TableCell>
											{conversa.leadId ? <Link to={`/leads/${conversa.leadId}`}>Ver lead</Link> : '—'}
										</TableCell>
										<TableCell className="tabular-nums">{formatDateTime(conversa.updatedAt)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					<div className="grid gap-3 md:hidden">
						{state.data.items.map((conversa) => (
							<Card key={conversa.id}>
								<CardContent className="pt-6">
									<div className="flex items-start justify-between gap-2">
										<Link
											to={`/conversations/${conversa.id}`}
											className="font-medium text-primary hover:underline"
										>
											{conversa.chatIdExterno}
										</Link>
										<Badge variant="secondary">{conversa.canal}</Badge>
									</div>
									<p className="mt-1 text-sm text-muted-foreground">
										{conversa.leadId ? 'Com lead associado' : 'Sem lead'} ·{' '}
										{formatDateTime(conversa.updatedAt)}
									</p>
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
