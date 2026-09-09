// Frontend environment. Only non-secret, browser-safe values:
// VITE_API_URL selects the Axis API base URL (same-origin default).
export function getApiBaseUrl(): string {
	const configured = import.meta.env.VITE_API_URL as string | undefined;
	const base = (configured ?? '').trim().replace(/\/+$/, '');
	return base;
}
