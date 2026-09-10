/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Development-only API proxy: the browser talks same-origin (/api/*) and Vite
// forwards to the backend. Production serves the built panel from a panel
// origin listed in the backend PANEL_ORIGIN allowlist instead — the proxy
// must never become a production architecture assumption.
export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 5173,
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true,
			},
			'/health': {
				target: 'http://localhost:3000',
				changeOrigin: true,
			},
		},
	},
	test: {
		environment: 'jsdom',
		include: ['src/**/*.test.{ts,tsx}'],
	},
});
