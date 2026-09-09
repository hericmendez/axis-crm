import { Link, useParams } from 'react-router-dom';
import { Badge, Card, EmptyState, ErrorState, PageHeader } from '../../components/ui.js';
import { Loading } from '../../components/Loading.js';
import { useApi } from '../../lib/use-api.js';
import { fetchConversa } from './api.js';

function formatDateTime(value: string): string {
	return new Date(value).toLocaleString('pt-BR', {
		timeZone: 'America/Sao_Paulo',
		day: '2-digit',
		month: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function ConversationDetailPage() {
	const { id = '' } = useParams();
	const state = useApi(() => fetchConversa(id), [id]);

	if (state.status !== 'success') {
		return (
			<>
				<PageHeader title="Conversa" />
				{state.status === 'error' ? (
					<ErrorState error={state.error} onRetry={state.reload} />
				) : (
					<Loading label="Carregando conversa…" />
				)}
			</>
		);
	}

	const conversa = state.data;

	return (
		<>
			<PageHeader
				title={conversa.chatIdExterno}
				subtitle={`Canal ${conversa.canal}`}
				actions={<Link to="/conversations">Voltar</Link>}
			/>
			<div className="axis-cards">
				<Card title="Associação">
					<p>
						Lead:{' '}
						{conversa.leadId ? <Link to={`/leads/${conversa.leadId}`}>Ver lead</Link> : 'não associado'}
					</p>
					{conversa.summary ? (
						<>
							<h3>Resumo</h3>
							<p>{conversa.summary}</p>
						</>
					) : null}
				</Card>
			</div>
			<Card title={`Mensagens (${conversa.mensagens.length} recentes)`}>
				{conversa.mensagens.length === 0 ? (
					<EmptyState message="Sem mensagens." />
				) : (
					<div className="axis-messages">
						{conversa.mensagens.map((mensagem) => (
							<div key={mensagem.id} className={`axis-message ${mensagem.papel}`}>
								<span>{mensagem.conteudo}</span>
								<span className="axis-message-meta">
									<Badge tone={mensagem.papel === 'usuario' ? 'info' : 'ok'}>
										{mensagem.papel === 'usuario' ? 'Cliente' : 'Axis'}
									</Badge>{' '}
									{formatDateTime(mensagem.criadoEm)}
								</span>
							</div>
						))}
					</div>
				)}
			</Card>
		</>
	);
}
