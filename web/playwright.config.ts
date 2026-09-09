import { defineConfig, devices } from '@playwright/test';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

// Minimal browser E2E: real built panel (vite preview) against the real API
// (scripts/e2e-serve.ts with isolated in-memory MongoDB). No API mocking
// except the external Google OAuth redirect target, which cannot be
// deterministic. Chromium comes from the environment (/usr/bin/chromium);
// no browser download is required.
export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	use: {
		baseURL: 'http://127.0.0.1:4173',
		...devices['Desktop Chrome'],
		launchOptions: {
			executablePath: '/usr/bin/chromium',
			args: ['--no-sandbox', '--disable-gpu'],
		},
	},
	webServer: [
		{
			command: 'pnpm tsx ../scripts/e2e-serve.ts',
			cwd: rootDir,
			env: {
				PORT: '3101',
				NODE_ENV: 'test',
				LOG_LEVEL: 'silent',
				JWT_ACCESS_SECRET: 'e2e-access-secret',
				BCRYPT_ROUNDS: '4',
				// Never invoked by the journeys (no chat traffic); satisfies boot validation.
				GROQ_API_KEY: 'e2e-dummy-key',
				// The preview origin must be allowlisted or the browser blocks API reads.
				PANEL_ORIGIN: 'http://127.0.0.1:4173',
			},
			url: 'http://127.0.0.1:3101/health',
			timeout: 120000,
			reuseExistingServer: false,
			stdout: 'pipe',
			stderr: 'pipe',
		},
		{
			command: 'pnpm vite preview --port 4173 --strictPort --host 127.0.0.1',
			cwd: rootDir,
			url: 'http://127.0.0.1:4173',
			timeout: 60000,
			reuseExistingServer: false,
		},
	],
});
