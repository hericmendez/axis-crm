# Roadmap

## Fase 0 — Fundação

- TypeScript
- Express
- configuração por ambiente
- logging
- tratamento global de erros
- MongoDB
- health check

## Fase 1 — Domínio CRM

- Lead
- agenda
- vendas
- métricas
- repositories
- services
- validações

## Fase 2 — WhatsApp

- sessão persistente
- QR Code/status
- recebimento de mensagens
- grupos
- menções ao Axis
- proteção contra loops

## Fase 3 — IA

- adapter de LLM (Groq)
- classificação de mensagens
- saída estruturada
- conversation memory
- internal tools
- fallback conversacional
- memória longa (summary)

## Fase 4 — Integrações Google (COMPLETA)

- Per-user Google OAuth
- Resource Provisioning automática
- Domain Projection (Calendar + Sheets)
- Failure & Retry Strategy
- Runtime Validation

## Fase 5 — Assistente de Agenda

### Objetivo

Transformar o Axis de um sistema que apenas **cria** eventos no Calendar em um assistente que **lê,Consulta,corrige e gerencia** a agenda do usuário.

### Problema

A ferramenta `CONSULTAR_AGENDA` hoje consulta apenas o MongoDB.
O Google Calendar é used exclusivamente como projeção (write-only).
O assistente não consegue:
- ler eventos existentes no Calendar
- sugerir horários disponíveis
- detectar conflitos
- corrigir/agendar considerando agenda real

### PASSOs

- **5.1** Calendar Query Adapter — adapter de leitura do Google Calendar
- **5.2** Agenda Avançada — consulta combinada Calendar+MongoDB, disponível no chat
- **5.3** Vinculação Conversa→Lead — associação automática lead↔conversa
- **5.4** Correção de Eventos — cancelamento e reagendamento via chat

### Princípios

- MongoDB continua fonte de verdade para domínio
- Calendar é authoritative para disponibilidade (read-through)
- Separação entre consulta (read) e projeção (write)
- Failure isolation mantida

### Fora do escopo

- Multi-usuário WhatsApp
- Projeções assíncronas
- Reconciliação automática
- Fallback Ollama
- API/painel React
- Produção/Docker

## Fase 6 — API/painel ✅ COMPLETA (veredicto 6.10: 706 backend + 69 frontend + 10 E2E verdes)

### Objetivo

Expor o domínio do Axis (leads, eventos, agenda, conversas, métricas,
integrações) via HTTP autenticada e operá-lo por um painel React separado,
com tenancy multi-user e ownership explícito — sem duplicar regras de
domínio e sem que o painel acesse MongoDB, WhatsApp ou Google diretamente.

### Decisões (ver ADR-004)

- Multi-user com ownership (`resource.userId === req.userId`, mismatch → 404)
- Painel usa login email+senha com JWT bearer + refresh; API key mantida só p/ integrações
- React como aplicação separada, somente HTTP, contrato OpenAPI antes das telas
- CORS por allowlist (`PANEL_ORIGIN`), nunca `*`
- Agenda: congela `GET /api/agenda` (legado, deprecated), nova `GET /api/v1/agenda` (5.2)
- WhatsApp MVP: somente status + QR (`GET /api/whatsapp/status`)

### PASSOs

- **6.1** Especificação + arquitetura ✅ (ADR-004, este documento)
- **6.2** Auth foundation ✅ — User email+passwordHash, login/refresh rotation/logout, middleware `authenticate` fail-closed, coexistência JWT/API Key, testes
- **6.3** Tenancy / ownership ✅ — `userId` obrigatório em Lead/Evento/Conversa, backfill idempotente, índices por tenant, scoping em repositories/services/controllers/router/tools, matriz 401/404, testes
- **6.4** API hardening + CORS ✅ — CORS allowlist (`PANEL_ORIGIN`, sem wildcard), `/api/auth/*` público, rate limit login/refresh, JWT scheme case-insensitive + sub ObjectId, JSON malformado → 400
- **6.5** Domain/API gap-fill ✅ — `GET /api/v1/agenda` (AgendaView), Conversations API (lista/detalhe bounded), evento GET + `eventoId` explícito (cancel/reagendar reutilizando semântica), filtros de lead, WhatsApp v1 status/QR, flags Google
- **6.6** API contract ✅ — `docs/api/openapi.yaml` (OpenAPI 3.1, 24 rotas) publicado e testado (`tests/unit/openapi-contract.test.ts`); `docs/07-api.md` reduzido a guia que aponta para a spec
- **6.7** React foundation ✅ — `web/` (React 18 + Vite 7 + Router 6, pacote `axis-panel`), HTTP client + `ApiError`, tipos espelho OpenAPI, AuthContext, guards, AppShell, decisão de tokens documentada
- **6.8** Authentication UX ✅ — login real (`/login`), restore via refresh, 401 com refresh single-flight + retry único, logout com revogação best-effort, guards com loading, shell com usuário/sair
- **6.9** Panel screens ✅ — Dashboard, Leads (CRUD), Agenda (v1 + ações), Conversas, Integrações; shell com sidebar, primitivos UI, testes
- **6.10** Integration / E2E ✅ — jornada HTTP cross-tenant (auth/tenancy/lifecycle/agenda/conversas), Playwright (10 journeys: painel real + API real + Mongo isolado), contrato OpenAPI coberto

### Fora do escopo (MVP)

- `reconnect`/`logout` do WhatsApp via painel; envio de mensagens pelo painel
- Roles/permissões além de ownership; novos provedores além de Google
- Remoção do `/api/agenda` legado (vai para a Fase 7); reconciliação/outbox

### Critérios de aceitação (resumo; checklist completo na especificação)

Login JWT funcionando; ownership enforced (matriz own/other/missing);
contrato OpenAPI publicado e testado; telas 6.9 operando contra a API;
CORS allowlist; suíte completa verde; build/lint/diff-check passando.

## Fase 7 — Produção

- Docker
- VPS
- logs
- health/readiness
- backups
- segurança
- observabilidade

---

## Decisões Arquiteturais — Google Integration

### Fonte de verdade

MongoDB permanece como fonte de verdade canônica para domínio (leads, eventos).

### Projeções

Google Calendar e Google Sheets são projeções de domínio — não fontes de verdade para dados de negócio.

### Consulta de agenda

Para disponibilidade e leitura de agenda, Google Calendar é authoritative.
O assistente deve ler do Calendar quando o usuário pergunta sobre sua agenda.

### Per-user OAuth

Per-user OAuth fornece acesso a recursos Google proprietários por usuário.

### Falhas Google

Falhas Google não causam rollback de transações MongoDB.

---

## PASSOs Implementados

```
PASSO 1   — Per-user Google OAuth              ✅
PASSO 2   — Google Resource Provisioning        ✅
PASSO 3.1 — Domain Model Preparation           ✅
PASSO 3.2 — Calendar Projection                ✅
PASSO 3.3 — Calendar Reschedule/Cancel         ✅
PASSO 3.4 — Sheets Projection                  ✅
PASSO 3.5 — Failure & Retry Strategy           ✅
PASSO 3.6 — Runtime Validation                 ✅
PASSO 3.7 — Roadmap/Architecture Audit         ✅
PASSO 3.8 — Auto-Provisioning                  ✅
PASSO 5.1 — Calendar Query Adapter             ✅
PASSO 5.2 — Agenda Avançada                    ✅
PASSO 5.3 — Vinculação Conversa→Lead           ✅
PASSO 5.4 — Correção de Eventos                ✅
```
