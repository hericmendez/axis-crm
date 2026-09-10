# Axis Panel — frontend architecture (Phase 6.7 foundation)

Separate React application (`web/`, package `axis-panel`) talking to the
Axis API over HTTP only. Canonical API contract: `docs/api/openapi.yaml`.

## Decisions

### Location: `web/`, workspace member, independently runnable
`pnpm-workspace.yaml` already existed, so `web` joins it (`packages: [web]`).
Backend workflow is unchanged (`pnpm test/build/lint` at root still target
`src`/`tests`); frontend commands run via `pnpm --dir web <script>`.

### Stack: React 18 + Vite 7 + TypeScript strict + React Router 6
No Next.js/SSR/PWA. UI via Tailwind CSS v4 + shadcn-style primitives
(`src/components/ui/`, Radix under the hood) + lucide-react icons. Design
tokens live in `src/index.css` (`:root` / `.dark`); theme state in
`src/lib/theme.tsx` (persisted, OS preference default, FOUC guard in
`index.html`). Shell: collapsible sidebar (persisted), mobile drawer,
top bar with theme toggle and logout.

### API client: one shared module (`src/lib/api-client.ts`)
`apiRequest`/`apiGet` + normalized `ApiError` (status/kind/message/data).
Components never call `fetch()` directly; feature services (6.9) will call
these helpers. Bearer token resolves per request via an injected hook so
login/refresh rotation (6.8) plugs in without touching call sites.

### OpenAPI types: Option B — manually maintained mirror (`src/types/api.ts`)
No codegen tool existed in the repo; introducing one (openapi-typescript and
friends) outweighs the benefit while the contract surface is small. Rule:
`docs/api/openapi.yaml` is authoritative; `src/types/api.ts` mirrors it by
hand and any drift is a bug — report it, don't fork the contract. Revisit
generation if the contract grows painful to mirror.

### Token storage: access in memory, refresh in `localStorage`
Backend contract: short-lived access JWT + single-use rotating refresh token,
no cookies (CORS `credentials: false`). Therefore: access token lives only in
`AuthContext` state (see `src/lib/auth-storage.ts`); refresh token persists in
`localStorage` under `axis.refreshToken`. Rotation bounds the blast radius of
a stolen refresh token. No secrets ever live in `VITE_*` env (browser-visible).

### State: React context only
`AuthProvider` owns the session (`status`, `user`, `login()`, `logout()`).
No Redux/Zustand/Query: nothing else needs global state yet. Async operations
use local state (`Loading` component covers the convention).

### Authentication flow (Phase 6.8)
`src/auth/session.ts` owns session mechanics; `AuthProvider` mirrors them
into React; `lib/api-client.ts` owns HTTP mechanics via injected hooks
(`configureAuthHooks`) — never the reverse, so there is no import cycle:
`login → POST /api/auth/login → access (memory) + refresh (localStorage)`;
boot → `restoreSession()` (refresh if a token is stored, else
unauthenticated); request → `401` → one shared refresh → single retry;
refresh failure → session dropped; logout → best-effort server revoke +
always-cleared local state. A generation counter guards logout-during-refresh
(the late pair is revoked, never applied). Guards render `Loading` while
`status === 'loading'`, so protected content never flashes.

### Routing: public/protected boundary, no business screens yet
`/` (protected), `/login` (public-only, real login screen since 6.8),
`*` (Not Found). Guards in `src/app/guards.tsx` are UX only — the backend
stays the authorization authority.

### Future feature convention (documented, not scaffolded)
`src/features/<auth|leads|agenda|conversations|metrics|google|whatsapp>/`
with colocated `api.ts` (feature service over the shared client) +
components. Empty folders are intentionally absent; follow the convention
when 6.9 starts.

## Configuration

| Variable | Purpose | Secret? |
|---|---|---|
| `VITE_API_URL` | API base URL (empty = same-origin) | No (browser-visible by design) |

Dev: `vite dev` proxies `/api` and `/health` to `http://localhost:3000`
(dev-only; production uses a `PANEL_ORIGIN`-listed origin instead).
Backend dev needs that origin (default `http://localhost:5173`) or the proxy.

## Security boundaries (restated from ADR-004)
Frontend route guards are UX, never authorization. No backend imports, no
Mongoose, no direct Google/WhatsApp/Mongo access — HTTP only. No CORS
weakening; no `Access-Control-Allow-Origin: *` anywhere.
