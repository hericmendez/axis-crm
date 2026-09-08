# ADR-003 — Per-user Google OAuth & Domain Projection

## Status

Accepted

## Context

O Axis CRM precisa integrar com Google Calendar e Google Sheets para projeção de eventos e leads. O roadmap original (Fase 4) previa "credenciais por configuração" e "adapters isolados", assumindo um modelo de service account compartilhado.

Durante a implementação, tornou-se necessário suportar **OAuth por usuário** para:

- Recursos Google proprietários por usuário (Calendar e Spreadsheet individuais)
- Isolamento de projeções entre usuários
- Identidade persistente de recursos Google (`calendarId`, `spreadsheetId`)
- Operação multi-usuário

## Decision

Implementar:

1. **Per-user Google OAuth** — cada usuário autentica individualmente; `GoogleConnection` persiste `refreshToken`, `calendarId`, `spreadsheetId`
2. **Resource Provisioning** — Calendar e Spreadsheet criados automaticamente após OAuth
3. **Domain Projection** — Calendar e Sheets são projeções pós-commit do MongoDB
4. **Failure Isolation** — falhas Google não causam rollback de transações MongoDB

### Arquitetura de Projeção

```
Domain Service (MongoDB commit)
    ↓
Projection Layer (try/catch)
    ↓
Google Calendar / Sheets
    ↓
Failure → log, não propaga
```

### Identidade de Eventos

- `googleEventId` persistido no Evento
- ID determinístico baseado no ObjectId (`eventoIdToGoogleEventId`)
- `previousEventoId` para cadeia de predecessors (REAGENDAMENTO/DESISTENCIA/NO_SHOW)

### Identidade de Leads no Sheets

- Telefone como identidade (colunaแรก)
- Append quando novo, update quando existente
- Header lazy (criado na primeira projeção)

## Alternatives Considered

1. **Service Account compartilhado**: rejeitado — não suporta recursos por usuário; todos os usuários compartilhariam o mesmo Calendar/Spreadsheet

2. **OAuth com refresh token único**: rejeitado — um único token não suporta múltiplos usuários com recursos isolados

3. **Async projection (outbox/worker)**: considerado para futuro; síncrono é suficiente para o volume atual

## Consequences

Positivas:
- Recursos Google isolados por usuário
- Identidade persistente de recursos
- Projeções determinísticas e idempotentes
- Falhas Google não afetam o domínio
- Retry controlado para erros transitórios

Negativas:
- Mais complexidade que service account compartilhado
- Requer fluxo OAuth por usuário (browser interaction)
- Refresh tokens precisam de armazenamento persistente
- Google API quotas por projeto

## Related Documentation

- docs/00-roadmap.md (Fase 4 atualizada)
- docs/development_context.md
- src/integrations/google/calendar/calendar.projection.ts
- src/integrations/google/sheets/sheets.projection.ts
- src/integrations/google/oauth.service.ts
- src/integrations/google/provisioner.ts
