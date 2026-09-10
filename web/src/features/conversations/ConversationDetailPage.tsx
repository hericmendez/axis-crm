import { Link, useParams } from 'react-router-dom';
import { PageHeader, EmptyState, ErrorState, LoadingState } from '../../components/ui.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.js';
import { Separator } from '../../components/ui/separator.js';
import { cn } from '../../lib/utils.js';
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
					<LoadingState label="Carregando conversa…" rows={3} />
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
				actions={
					<Button variant="outline" asChild>
						<Link to="/conversations">Voltar</Link>
					</Button>
				}
			/>
			<Card className="mb-4">
				<CardHeader>
					<CardTitle>Associação</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-2 text-sm">
					<p>
						Lead:{' '}
						{conversa.leadId ? <Link to={`/leads/${conversa.leadId}`}>Ver lead</Link> : 'não associado'}
					</p>
					{conversa.summary ? (
						<>
							<Separator />
							<div>
								<h3 className="mb-1 font-medium">Resumo</h3>
								<p className="text-muted-foreground">{conversa.summary}</p>
							</div>
						</>
					) : null}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Mensagens ({conversa.mensagens.length} recentes)</CardTitle>
				</CardHeader>
				<CardContent>
					{conversa.mensagens.length === 0 ? (
						<EmptyState message="Sem mensagens." />
					) : (
						<ol className="flex list-none flex-col gap-3 p-0">
							{conversa.mensagens.map((mensagem) => {
								const fromClient = mensagem.papel === 'usuario';
								return (
									<li
										key={mensagem.id}
										className={cn('flex', fromClient ? 'justify-end' : 'justify-start')}
									>
										<div
											className={cn(
												'max-w-[85%] rounded-lg border px-3 py-2 text-sm shadow-sm sm:max-w-[70%]',
												fromClient
													? 'border-primary/30 bg-primary text-primary-foreground'
													: 'border-border bg-muted text-foreground',
											)}
										>
											<p className="m-0 whitespace-pre-wrap break-words">{mensagem.conteudo}</p>
											<p className="m-0 mt-1 flex items-center gap-2 text-xs opacity-80">
												<Badge variant={fromClient ? 'secondary' : 'outline'}>
													{fromClient ? 'Cliente' : 'Axis'}
												</Badge>
												<time dateTime={mensagem.criadoEm}>{formatDateTime(mensagem.criadoEm)}</time>
											</p>
										</div>
									</li>
								);
							})}
						</ol>
					)}
				</CardContent>
			</Card>
		</>
	);
}
