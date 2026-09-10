import { useEffect, useState } from 'react';
import { CalendarCheck, MessageSquare, PlugZap, RefreshCw } from 'lucide-react';
import { ApiError } from '../../lib/api-client.js';
import { useApi, useMutation } from '../../lib/use-api.js';
import { Loading } from '../../components/Loading.js';
import { PageHeader, EmptyState, ErrorState, ConfirmDialog } from '../../components/ui.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.js';
import { Alert, AlertDescription } from '../../components/ui/alert.js';
import { Separator } from '../../components/ui/separator.js';
import {
	disconnectGoogle,
	fetchGoogleConnectUrl,
	fetchGoogleStatus,
	fetchWhatsAppQr,
	fetchWhatsAppStatus,
} from './api.js';

const QR_POLL_MS = 10000;

const WHATSAPP_STATUS_TONE: Record<string, 'success' | 'warning' | 'secondary'> = {
	conectado: 'success',
	aguardando_qr: 'warning',
	conectando: 'warning',
	desconectado: 'secondary',
};

export function IntegrationsPage() {
	const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const google = useApi(() => fetchGoogleStatus(), []);
	const whatsapp = useApi(() => fetchWhatsAppStatus(), []);
	const qr = useApi(() => fetchWhatsAppQr(), []);
	const disconnection = useMutation(disconnectGoogle);
	const [connectPending, setConnectPending] = useState(false);

	// Bounded QR polling: only while the backend reports awaiting_qr, so a
	// fresh code appears without hammering the endpoint otherwise.
	useEffect(() => {
		if (whatsapp.status !== 'success' || whatsapp.data.status !== 'aguardando_qr') return undefined;
		const timer = window.setInterval(() => {
			qr.reload();
			whatsapp.reload();
		}, QR_POLL_MS);
		return () => window.clearInterval(timer);
		// Reload only when the awaited status changes (intentional dep, not exhaustive).
	}, [whatsapp.status === 'success' ? whatsapp.data?.status : null]);

	async function handleConnect() {
		setNotice(null);
		setConnectPending(true);
		try {
			const url = await fetchGoogleConnectUrl();
			window.location.href = url;
		} catch (err) {
			setNotice(err instanceof ApiError ? err.message : 'Falha ao iniciar conexão.');
			setConnectPending(false);
		}
	}

	async function handleDisconnect() {
		const ok = await disconnection.run(undefined);
		setConfirmingDisconnect(false);
		if (ok !== null) {
			setNotice('Google desconectado.');
			google.reload();
		}
	}

	return (
		<>
			<PageHeader title="Integrações" subtitle="Conexões do tenant atual" />
			{notice ? (
				<Alert className="mb-4">
					<AlertDescription>{notice}</AlertDescription>
				</Alert>
			) : null}
			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0">
						<div>
							<CardTitle className="flex items-center gap-2">
								<CalendarCheck className="size-4 text-muted-foreground" aria-hidden="true" />
								Google
							</CardTitle>
							<CardDescription>Calendar e planilha por tenant</CardDescription>
						</div>
					</CardHeader>
					<CardContent>
						{google.status === 'error' ? (
							<ErrorState error={google.error} onRetry={google.reload} />
						) : google.status !== 'success' ? (
							<Loading label="Carregando Google…" />
						) : !google.data.connected ? (
							<div className="grid gap-3">
								<p className="text-sm text-muted-foreground">
									<Badge variant="secondary">Não conectado</Badge>
								</p>
								<div>
									<Button type="button" onClick={handleConnect} disabled={connectPending}>
										<PlugZap aria-hidden="true" />
										{connectPending ? 'Aguarde…' : 'Conectar Google'}
									</Button>
								</div>
							</div>
						) : (
							<div className="grid gap-3">
								<p className="flex flex-wrap items-center gap-2 text-sm">
									<Badge variant="success">Conectado</Badge>
									<span className="break-all">{google.data.email}</span>
								</p>
								<Separator />
								<ul className="grid gap-1 text-sm">
									<li>
										Calendário:{' '}
										<Badge variant={google.data.calendarConfigured ? 'success' : 'warning'}>
											{google.data.calendarConfigured ? 'configurado' : 'não configurado'}
										</Badge>
									</li>
									<li>
										Planilha:{' '}
										<Badge variant={google.data.spreadsheetConfigured ? 'success' : 'warning'}>
											{google.data.spreadsheetConfigured ? 'configurada' : 'não configurada'}
										</Badge>
									</li>
								</ul>
								<div>
									<Button
										type="button"
										variant="destructive"
										onClick={() => setConfirmingDisconnect(true)}
									>
										Desconectar
									</Button>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0">
						<div>
							<CardTitle className="flex items-center gap-2">
								<MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />
								WhatsApp
							</CardTitle>
							<CardDescription>Canal único · somente leitura</CardDescription>
						</div>
					</CardHeader>
					<CardContent>
						{whatsapp.status === 'error' ? (
							<ErrorState error={whatsapp.error} onRetry={whatsapp.reload} />
						) : whatsapp.status !== 'success' ? (
							<Loading label="Carregando WhatsApp…" />
						) : (
							<div className="grid gap-3">
								<p>
									<Badge variant={WHATSAPP_STATUS_TONE[whatsapp.data.status] ?? 'secondary'}>
										{whatsapp.data.status}
									</Badge>
								</p>
								{whatsapp.data.status === 'aguardando_qr' ? (
									qr.status === 'success' ? (
										<pre
											aria-label="QR Code do WhatsApp"
											className="overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs"
										>
											{qr.data.qr}
										</pre>
									) : qr.status === 'error' ? (
										<ErrorState error={qr.error} onRetry={qr.reload} />
									) : (
										<Loading label="Aguardando QR…" />
									)
								) : null}
								<div>
									<Button type="button" variant="outline" size="sm" onClick={() => whatsapp.reload()}>
										<RefreshCw aria-hidden="true" /> Atualizar
									</Button>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
			{confirmingDisconnect ? (
				<ConfirmDialog
					title="Desconectar Google"
					message="Remover a integração Google deste tenant?"
					confirmLabel="Desconectar"
					pending={disconnection.submitting}
					onCancel={() => setConfirmingDisconnect(false)}
					onConfirm={handleDisconnect}
				/>
			) : null}
			{disconnection.error instanceof ApiError ? (
				<Alert variant="destructive" className="mt-4">
					<AlertDescription>{disconnection.error.message}</AlertDescription>
				</Alert>
			) : null}
			{google.status === 'success' && !google.data.connected ? (
				<div className="mt-4">
					<EmptyState message="Dica: conecte o Google para projetar agenda e leads." />
				</div>
			) : null}
		</>
	);
}
