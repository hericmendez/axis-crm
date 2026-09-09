import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, EmptyState, ErrorState, PageHeader, Pagination } from '../../components/ui.js';
import { Loading } from '../../components/Loading.js';
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
			<form
				onSubmit={(e) => {
					e.preventDefault();
					setPage(1);
					setApplied(chatIdExterno.trim());
				}}
			>
				<div className="axis-form-row">
					<label>
						Chat externo{' '}
						<input
							value={chatIdExterno}
							onChange={(e) => setChatIdExterno(e.target.value)}
							placeholder="5511…@c.us"
						/>
					</label>
					<button type="submit" className="axis-btn secondary">
						Filtrar
					</button>
				</div>
			</form>
			{state.status === 'loading' || state.status === 'idle' ? (
				<Loading label="Carregando conversas…" />
			) : state.status === 'error' ? (
				<ErrorState error={state.error} onRetry={state.reload} />
			) : state.data.total === 0 ? (
				<EmptyState message="Nenhuma conversa encontrada." />
			) : (
				<>
					<div className="axis-table-wrap">
						<table className="axis-table">
							<thead>
								<tr>
									<th>Chat</th>
									<th>Canal</th>
									<th>Lead</th>
									<th>Atualizada em</th>
								</tr>
							</thead>
							<tbody>
								{state.data.items.map((conversa) => (
									<tr key={conversa.id}>
										<td>
											<Link to={`/conversations/${conversa.id}`}>{conversa.chatIdExterno}</Link>
										</td>
										<td>
											<Badge>{conversa.canal}</Badge>
										</td>
										<td>{conversa.leadId ? <Link to={`/leads/${conversa.leadId}`}>Ver lead</Link> : '—'}</td>
										<td>{formatDateTime(conversa.updatedAt)}</td>
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
