import { apiGet, apiRequest } from '../../lib/api-client.js';
import type { GoogleStatus, WhatsAppQr, WhatsAppStatus } from '../../types/api.js';

export function fetchGoogleStatus(): Promise<GoogleStatus> {
	return apiGet<GoogleStatus>('/api/v1/integrations/google/status');
}

export async function fetchGoogleConnectUrl(): Promise<string> {
	const result = await apiGet<{ url: string }>('/api/v1/integrations/google/connect');
	return result.url;
}

export function disconnectGoogle(): Promise<void> {
	return apiRequest<void>('/api/v1/integrations/google', { method: 'DELETE' });
}

export function fetchWhatsAppStatus(): Promise<WhatsAppStatus> {
	return apiGet<WhatsAppStatus>('/api/v1/whatsapp/status');
}

export function fetchWhatsAppQr(): Promise<WhatsAppQr> {
	return apiGet<WhatsAppQr>('/api/v1/whatsapp/qr');
}
