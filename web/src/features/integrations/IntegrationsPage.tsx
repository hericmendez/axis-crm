import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api-client.js';
import { useApi, useMutation } from '../../lib/use-api.js';
import { Loading } from '../../components/Loading.js';
import { Badge, Card, ConfirmDialog, EmptyState, ErrorState, PageHeader } from '../../components/ui.js';
import {
	disconnectGoogle,
	fetchGoogleConnectUrl,
	fetchGoogleStatus,
	fetchWhatsAppQr,
	fetchWhatsAppStatus,
} from './api.js';

const QR_POLL_MS = 10000;

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
			<PageHeader title="Integrações" />
			{notice ? <p role="status">{notice}</p> : null}
			<div className="axis-cards">
				<Card title="Google">
					{google.status === 'error' ? (
						<ErrorState error={google.error} onRetry={google.reload} />
					) : google.status !== 'success' ? (
						<Loading label="Carregando Google…" />
					) : !google.data.connected ? (
						<>
							<p>Não conectado.</p>
							<button type="button" className="axis-btn" onClick={handleConnect} disabled={connectPending}>
								{connectPending ? 'Aguarde…' : 'Conectar Google'}
							</button>
						</>
					) : (
						<>
							<p>
								<Badge tone="ok">Conectado</Badge> {google.data.email}
							</p>
							<p>
								Calendário: {google.data.calendarConfigured ? 'configurado' : 'não configurado'} · Planilha:{' '}
								{google.data.spreadsheetConfigured ? 'configurada' : 'não configurada'}
							</p>
							<button
								type="button"
								className="axis-btn danger"
								onClick={() => setConfirmingDisconnect(true)}
							>
								Desconectar
							</button>
						</>
					)}
				</Card>
				<Card title="WhatsApp">
					{whatsapp.status === 'error' ? (
						<ErrorState error={whatsapp.error} onRetry={whatsapp.reload} />
					) : whatsapp.status !== 'success' ? (
						<Loading label="Carregando WhatsApp…" />
					) : (
						<>
							<p>
								<Badge tone={whatsapp.data.connected ? 'ok' : 'warn'}>{whatsapp.data.status}</Badge>
							</p>
							{whatsapp.data.status === 'aguardando_qr' ? (
								qr.status === 'success' ? (
									<pre aria-label="QR Code do WhatsApp">{qr.data.qr}</pre>
								) : qr.status === 'error' ? (
									<ErrorState error={qr.error} onRetry={qr.reload} />
								) : (
									<Loading label="Aguardando QR…" />
								)
							) : null}
							<button type="button" className="axis-btn secondary" onClick={() => whatsapp.reload()}>
								Atualizar
							</button>
						</>
					)}
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
				<p className="axis-field-error" role="alert">
					{disconnection.error.message}
				</p>
			) : null}
			{google.status === 'success' && !google.data.connected ? (
				<EmptyState message="Dica: conecte o Google para projetar agenda e leads." />
			) : null}
		</>
	);
}
