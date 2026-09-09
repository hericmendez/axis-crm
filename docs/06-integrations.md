# Integrações

Cada integração deve possuir adapter próprio.

```text
integrations/
├── ollama/
├── google/
│   ├── auth.ts                    (Service Account + OAuth)
│   ├── oauth.service.ts           (Per-user OAuth flow)
│   ├── oauth-user-auth-provider.ts (OAuth token refresh)
│   ├── provisioner.ts             (Calendar + Spreadsheet provisioning)
│   ├── calendar/
│   │   ├── calendar.adapter.ts    (write: create, update, delete)
│   │   ├── calendar.interface.ts  (ICalendarAdapter)
│   │   ├── calendar.types.ts      (CalendarEvent, CalendarQueryEvent)
│   │   ├── calendar.projection.ts
│   │   ├── calendar-query.adapter.ts   (read: queryEvents)
│   │   └── calendar-query.interface.ts (ICalendarQueryAdapter)
│   └── sheets/
│       ├── sheets.adapter.ts
│       ├── sheets.projection.ts
│       └── sheets.interface.ts
└── whatsapp/
```

## Ollama

A aplicação deve depender de uma interface, não do Ollama diretamente.

```ts
interface LLMProvider {
  generate(input: LLMInput): Promise<LLMOutput>;
}
```

Isso permite trocar Ollama por outro provider sem reescrever o domínio.

## Google

Calendar e Sheets são services/adapters independentes.

Credenciais nunca devem ficar no código ou no Git.

### Per-user OAuth

Cada usuário autentica individualmente via Google OAuth 2.0.

`GoogleConnection` persiste:
- `userId` → `googleSubject`, `email`, `refreshToken`, `scopes`
- `calendarId` (Calendar dedicado)
- `spreadsheetId` (Spreadsheet dedicado)

### Resource Provisioning

Após OAuth, Calendar "Axis CRM" e Spreadsheet "Axis CRM" são criados automaticamente.

Provisioning é idempotente — skip se já existe.

### Calendar

Google Calendar suporta duas operações:

```
Write (Projection)
Domain Service (MongoDB commit)
    ↓
Projection Layer (try/catch)
    ↓
Google Calendar
    ↓
Failure → log, não propaga

Read (Query)
Agenda Service
    ↓
Calendar Query Adapter
    ↓
Google Calendar API (events.list)
    ↓
Normalized CalendarQueryEvent[]
```

A leitura é separada da escrita. O adapter de consulta não modifica eventos.

### Domain Projection

MongoDB é fonte de verdade. Google Calendar e Sheets são projeções.

```
Domain Service (MongoDB commit)
    ↓
Projection Layer (try/catch)
    ↓
Google Calendar / Sheets
    ↓
Failure → log, não propaga
```

### Failure Isolation

Falhas Google não causam rollback de transações MongoDB.

Retry controlado apenas para erros transitórios (429, 408, 5xx, network).
