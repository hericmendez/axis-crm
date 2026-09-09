# ADR-004 — Phase 6 API / Panel Architecture

## Status

Accepted (specification; implementation not started)

## Context

Phase 5 (Assistente de Agenda) is complete: the assistant reads the agenda
(5.1/5.2), links conversations to leads (5.3), and cancels/reschedules via
chat (5.4) — 580 tests green. Phase 6 ("API/painel") is specified in
`docs/00-roadmap.md` only as six nouns (autenticação, endpoints de
configuração, status do WhatsApp, QR Code, integrações, React separado),
with no steps, no acceptance criteria, and no auth/tenancy decisions.

The Phase 6 audit (predecessor task) established the facts this ADR builds on:

- Auth today is a **single shared API key** (`env.API_KEY`); `resolve-user`
  auto-creates one `User` from it. There is exactly one effective user and
  **no authorization layer**.
- `Lead`, `Evento` and `Conversa` schemas carry **no `userId`**; `userId`
  exists only to route Google projections (`GoogleConnection.userId`,
  `AXIS_USER_ID` bridge). The domain is single-tenant by construction.
- HTTP lead/evento writes **drop `req.userId`**; only Google OAuth
  controllers enforce it. `resolve-user` fails open (no userId → `next()`).
- `GET /api/agenda` serves the legacy Mongo-only view while the assistant
  uses the 5.2 merged `consultarAgenda` — two conflicting representations.
- No frontend, no API contract, and `docs/07-api.md` describes endpoints
  that do not exist. No panel login mechanism exists.

Building a panel directly on this foundation would either bake single-user
assumptions into a multi-user product or force a tenancy migration
mid-phase. The tenancy and auth decisions must therefore be explicit
**before** any structural change — that is this ADR.

## Decision

### 1. Multi-user tenancy with explicit ownership (chosen: alternative C)

Every domain resource belongs to exactly one user:

```text
User
 ├── Leads (userId, required, indexed)
 ├── Eventos (userId, required, indexed)
 ├── Conversas (userId, required, indexed)
 ├── GoogleConnection (userId — already exists)
 └── demais recursos
```

Enforcement rule (mandatory for all Phase 6 endpoints):

```text
authenticated user
        ↓
req.userId (fail closed: absent → 401)
        ↓
resource.userId === req.userId (mismatch → 404, never 403, to avoid oracle leaks)
```

The migration itself (schemas, backfill, repository scoping, controller
enforcement, indexes, tests) is step 6.3, not this task.

### 2. Panel authentication: JWT bearer, separate from API key

- Human panel login uses **email + password** against `User`
  (`passwordHash`, memory-hard hash), issuing a short-lived **access JWT**
  (bearer) plus a rotating **refresh token**. An `authenticate` middleware
  runs before `resolveUser` and establishes `req.userId`; unauthenticated
  → 401 (fail closed — replacing today's fail-open behavior on protected
  routes).
- The existing **API key is retained** for integrations/automation/internal
  callers and backward compatibility during transition. It authenticates
  *machines*, never browsers: no login, no session, no panel use.
- Coexistence: `authenticate` (JWT) and `apiKeyAuth` (key) are independent
  middlewares; a request is accepted if either establishes identity, and
  `req.userId` + an `authMethod` marker record which one did. Panel routes
  require JWT; integration routes accept the key.

### 3. Authorization = ownership

No roles in Phase 6 scope. A user can access only resources with
`resource.userId === req.userId`: leads, eventos, conversas, métricas
(scoped aggregations), Google connections, agenda views. Google stays
user-scoped as today; no duplication of the OAuth integration — Phase 6
adds only UX over the existing
`connect/callback/status/disconnect` endpoints.

### 4. React as a separate application consuming HTTP only

```text
Axis CRM Panel (React, separate app)
        │ HTTP + JWT bearer
        ↓
Axis CRM API (Express)
        ↓
Controllers → Domain Services → Repositories → MongoDB
```

The panel **never** touches MongoDB, WhatsApp internals, or Google APIs
directly. Repository location (same monorepo `panel/` vs separate repo) is
left as DECISION REQUIRED (see Open Questions); the default recommendation
is same-repository `panel/` for MVP to keep the contract in one checkout.

### 5. API contract: OpenAPI, contract-before-UI

`docs/api/openapi.yaml` (OpenAPI 3.1) is authored in step 6.6 **before**
any React screen work and is the single source of truth for the panel
HTTP client (generated types). Controllers and contract are kept in sync
by review + contract tests in CI.

### 6. CORS: explicit allowlist, never `*`

`PANEL_ORIGIN` env (comma-separated allowlist) drives `cors()`;
credentials permitted only for listed origins; local dev uses Vite proxy
(same-origin) to avoid credentialed cross-origin in development.
Production default denies unlisted origins.

### 7. Agenda: version, don't fork

`GET /api/agenda` (legacy `metricasService.agenda` shape) is frozen and
marked deprecated. The merged 5.2 view ships as **`GET /api/v1/agenda`**
(`AgendaView`, user-scoped via `req.userId`). Exactly one supported
representation going forward; legacy removal is a Phase 7 item.

### 8. WhatsApp surface for MVP: status + QR only

`GET /api/whatsapp/status` already returns `{ status, qr }` — sufficient
for the panel's connection widget. `reconnect`/`logout`/`send-via-panel`
are explicitly **out of MVP** (see Out of Scope); the chat channel stays
on WhatsApp.

### 9. API/domain boundaries preserved

Thin controllers + Zod validation → domain services (business rules) →
repositories (persistence). No business logic in routes, no MongoDB access
from the panel, no WhatsApp-service calls from HTTP except the existing
read-only status.

## Alternatives Considered

### A — Keep the API key as panel login

Rejected. A single shared secret cannot identify humans, cannot be
rotated per user, cannot express expiry, and grants full access to every
holder. It also conflates machine integration traffic with interactive
sessions (no CSRF/session semantics possible). Retained only for
machine-to-machine use.

### B — Remain single-user

Rejected. ADR-003 already committed Google to per-user OAuth with
per-user resources; keeping the domain single-tenant while projections
are per-user reproduces the exact mismatch the tenancy migration fixes.
It would also cap the product at one operator permanently, contradicting
the CRM's direction. The migration cost is real but bounded (three
schemas + backfill + scoping).

### C — Multi-user with ownership (chosen)

Chosen. Aligns domain tenancy with the already per-user Google layer,
gives the panel a coherent auth story (one login → one's own data), and
makes `req.userId` meaningful end-to-end. Cost: one careful migration
(step 6.3) with backfill and index work — sequenced before endpoint
expansion so no code is written twice.

### D — React inside the backend (served bundle / SSR in Express)

Rejected as the primary direction. It couples deploy lifecycles, drags
Node into serving static assets, and contradicts the roadmap's "React
separado". A separate app keeps the API independently testable and
deployable; the only coupling is the OpenAPI contract.

## Consequences

Positivas:

- Tenancy decided up front — no mid-phase migration surprise.
- Panel auth is human-grade (expiry, rotation, revocation path) while
  integrations keep working on the key.
- One agenda representation; one API contract; panel cannot bypass domain rules.
- Google/WhatsApp integrations reused, not rebuilt.

Negativas:

- Migration touches 3 schemas + backfill + every repository query — the
  largest single risk in Phase 6, mitigated by sequencing (6.3 before 6.5).
- JWT lifecycle (refresh rotation, revocation list) is a new subsystem to
  build, test, and operate.
- Legacy `/api/agenda` must be carried deprecated until Phase 7.
- Frontend more than doubles the deployable surface (hosting, CORS, env).

## Migration impact (for step 6.3, not executed here)

- **Schemas:** `Lead`, `Evento`, `Conversa` gain `userId: ObjectId ref User`,
  required for new docs, compound indexes (`{userId, ...}`); `User` gains
  `email (unique)`, `passwordHash`, panel fields. `GoogleConnection`
  unchanged (already user-scoped).
- **Backfill:** existing documents assigned to the operator user
  (single auto-created user today; `AXIS_USER_ID` mapping retired after).
- **Repositories:** every query scoped by `userId`; new indexes verified in
  production (`autoIndex` reliance revisited).
- **Services:** accept `userId`, enforce ownership at the boundary used by
  HTTP (chat flow passes conversation owner's id through as today).
- **Controllers/middleware:** `authenticate` before `resolveUser`;
  fail-closed 401; `GET /api/agenda` frozen; new `/api/v1/*` surface.
- **Tests:** ownership matrix per resource (own/other/missing user),
  migration test (backfill + index), contract tests for OpenAPI.

## Related Documentation

- docs/00-roadmap.md (Phase 6 specification)
- docs/development_context.md
- docs/07-api.md (note: partially stale — see audit)
- docs/decisions/ADR-003-per-user-google-oauth.md
- src/middlewares/api-key.middleware.ts
- src/middlewares/resolve-user.middleware.ts
- src/config/env.ts
