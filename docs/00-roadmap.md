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

- Ollama
- adapter de LLM
- classificação de mensagens
- saída estruturada
- conversation memory
- tool calling
- fallback conversacional

## Fase 4 — Integrações Google

### PASSO 1 — Per-user Google OAuth

- Google OAuth 2.0 por usuário
- `GoogleConnection` (userId → googleSubject, email, refreshToken, scopes)
- `OAuthState` com TTL
- Fluxo connect/callback/disconnect/status
- `OAuthUserAuthProvider` (token refresh automático)

### PASSO 2 — Google Resource Provisioning

- Calendar dedicado "Axis CRM" por usuário
- Spreadsheet dedicado "Axis CRM" por usuário
- `calendarId` e `spreadsheetId` persistidos em `GoogleConnection`
- Provisioning idempotente (skip se já existe)

### PASSO 3 — Domain Projection

- **3.1** Domain Model Preparation — `googleEventId`, `previousEventoId`, `userId` no Evento
- **3.2** Calendar Projection — AGENDAMENTO → create
- **3.3** Calendar Reschedule/Cancel — REAGENDAMENTO/DESISTENCIA/NO_SHOW → delete predecessor + create
- **3.4** Sheets Projection — Lead create/update → append/update row
- **3.5** Failure & Retry Strategy — idempotent create, transient DELETE retry, GET retry, failure isolation

### Arquitetura

- MongoDB é fonte de verdade
- Google Calendar e Sheets são projeções
- Per-user OAuth fornece acesso a recursos Google do usuário
- Falhas Google não causam rollback de transações MongoDB

## Fase 5 — API/painel

- autenticação
- endpoints de configuração
- status do WhatsApp
- QR Code
- integrações
- React separado

## Fase 6 — Produção

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

MongoDB permanece como fonte de verdade canônica.

### Projeções

Google Calendar e Google Sheets são projeções — não fontes de verdade.

### Per-user OAuth

Per-user OAuth fornece acesso a recursos Google proprietários por usuário.

### Falhas Google

Falhas Google não causam rollback de transações MongoDB.

### Confiabilidade

Projeção além do modelo síncrono best-effort atual é trabalho futuro.

---

## Evolução da Integração Google

O roadmap original não incluía per-user Google OAuth.

Durante a implementação, OAuth por usuário tornou-se necessário para suportar:

- recursos Google proprietários por usuário;
- projeções isoladas de Calendar e Spreadsheet;
- identidade persistente de recursos Google;
- operação multi-usuário.

Portanto, per-user OAuth é agora um requisito arquitetural oficial, não uma melhoria futura opcional.

### Sequência implementada

```
PASSO 1 — Per-user Google OAuth
PASSO 2 — Google Resource Provisioning
PASSO 3.1 — Domain Model Preparation
PASSO 3.2 — Calendar Projection
PASSO 3.3 — Calendar Reschedule/Cancel Projection
PASSO 3.4 — Sheets Projection
PASSO 3.5 — Failure & Retry Strategy
PASSO 3.6 — Runtime Validation
```
