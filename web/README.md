# Axis Panel

Separate React + Vite application for the Axis CRM web panel.

Talks to the Axis API over HTTP only. Contract: `docs/api/openapi.yaml`.

## Scripts

```bash
pnpm --dir web dev      # Vite dev server (:5173, proxies /api → :3000)
pnpm --dir web build    # tsc + vite build
pnpm --dir web preview  # serve the production build
pnpm --dir web lint     # eslint src
pnpm --dir web test     # vitest run
```

## Configuration

Copy `.env.example` to `.env` as needed:

```bash
VITE_API_URL=   # empty = same-origin (dev proxy handles /api)
```

Never put secrets in `VITE_*` variables — they ship to the browser.

Backend dev needs the panel origin in its `PANEL_ORIGIN` allowlist
(default dev origin: `http://localhost:5173`), or rely on the dev proxy.

## Architecture

See `docs/ARCHITECTURE.md` (this folder).
