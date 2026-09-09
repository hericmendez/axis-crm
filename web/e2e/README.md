# Browser E2E (Phase 6.10)

Minimal Playwright suite: the real built panel (`vite preview`) against the
real API (`scripts/e2e-serve.ts` with an isolated in-memory MongoDB).

## Requirements

- Chromium available to Playwright via `executablePath: /usr/bin/chromium`
  (see `web/playwright.config.ts`). No browser download is needed and none
  is performed (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` was used at install).
- Ports free: backend `3101`, panel preview `4173`.

## Run

```bash
pnpm --dir web e2e
```

This builds the panel with `VITE_API_URL=http://127.0.0.1:3101`, then runs
Playwright, which boots both servers automatically (`webServer`) and tears
them down afterwards.

## Data strategy

- `scripts/e2e-serve.ts` seeds two deterministic users
  (`e2e-a/b@example.com` / `senha-forte-123`) plus one conversation for user A.
- Specs run serially (`workers: 1`) and otherwise seed through the UI or the
  real API with unique values per spec (distinct phones/names).
- No test touches developer data: MongoDB is always in-memory and per-run.

## Boundaries

- The backend is never mocked. The only stubbed boundary is the *external*
  Google OAuth redirect target (asserted as navigation to the backend-issued
  URL domain), since real Google login cannot be deterministic.
- Real WhatsApp authentication and real Google OAuth grants remain manual
  validation (out of scope for deterministic automation).
