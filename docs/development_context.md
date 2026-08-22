# Contexto de Desenvolvimento — Axis CRM

> Arquivo de memória de trabalho. Atualizar a cada sessão para facilitar a retomada por agentes/devs.

## 1. Objetivo do projeto

**Axis CRM** (`package.json` name: `axis-crm`, v0.1.0) — rewrite de um CRM existente cujo núcleo é um **assistente comercial conversacional para WhatsApp**. O assistente interpreta linguagem natural (LLM local via Ollama) e executa operações de CRM: leads, agenda, eventos de venda e métricas.

Princípio central: **o LLM conversa/interpreta, mas nunca acessa banco nem executa ações diretamente.** Toda ação passa por código determinístico (services/tools). O projeto deve permanecer executável sem frontend.

Nota: "Grazi" (mencionada em docs/10-security.md) é aparentemente a usuária/cliente final do CRM anterior — separar as credenciais dela das credenciais do dev.

## 2. Stack

- Node.js ≥ 20, TypeScript strict, ESM
- Express 5
- MongoDB + Mongoose 8
- Zod 4 (validação)
- pino / pino-http (logs com redact de secrets)
- Vitest 3 + Supertest + mongodb-memory-server
- tsx (dev), ESLint 9 + typescript-eslint, Prettier, pnpm

## 3. Arquitetura (docs/01, 03, 04)

MVC com camadas rígidas:

```
Routes → Controllers → Services → Repositories/Integrations
                          ↑
                    AI Orchestrator
```

- Controllers finos; models nunca importados por controllers
- Repositories isolam persistência
- Integrações sempre atrás de adapters/interfaces (ex.: `interface LLMProvider`)
- Pipeline de IA: mensagem → ConversationService → AI Orchestrator → LLM Adapter → JSON estruturado validado (`mode: ACTION|CHAT`, intent, confidence, parameters) → router de intenção → tool/service
- Memória conversacional em 3 camadas (short-term, summary, contexto CRM) — ver docs/13. O CRM é a fonte da verdade.

## 4. Estado atual da implementação

Git: inicializado em `main`, **sem nenhum commit ainda** (todo o estado atual não está versionado).

### Concluído — Fases 0 e 1 do roadmap (~1.7k linhas em src+tests)

- `src/config/env.ts`: env carregada/validada num único módulo via Zod, cacheada (`getEnv`)
- `src/app.ts` / `src/server.ts`: Express + pino-http, graceful shutdown (SIGINT/SIGTERM, timeout 10s), handlers de unhandledRejection/uncaughtException, conexão Mongo
- **Domínio Lead completo**: model (telefone único), repository (CRUD, paginação, agregações), service com regras de negócio (normalização de telefone, duplicidade → 409, `dataConversao` só com status VENDIDO, auto-set na venda), controller fino com validação Zod, rotas `/api/leads`
- **Eventos**: model/service/repository — criar evento aplica efeitos no lead (VENDA→VENDIDO, NO_SHOW→NO_SHOW etc., atualizando dataAgendamento/dataConversao); log de falha parcial
- **Agenda**: `GET /api/agenda`; **Métricas**: `GET /api/metricas` (leadsPorStatus, eventosPorTipo, taxaConversao)
- Health check, error handler / not-found middlewares, `AppError`, utilitário de telefone
- Testes: unitários (validators lead/evento, telefone), infra (env, error-middleware, health), integração com Mongo em memória (`tests/integration/setup.ts`): APIs de leads/eventos, regras do lead.service, agenda+métricas

### Não existe ainda

`src/ai/`, `src/integrations/`, `src/whatsapp/` — Fases 2–5 pendentes.

Env já preparada antecipadamente no `.env` (não commitado): `OLLAMA_BASE_URL`, `OLLAMA_MODEL` (vazio), `WHATSAPP_SESSION_PATH`, `GOOGLE_*`.

## 5. Roadmap (docs/00-roadmap.md)

| Fase | Escopo | Status |
|---|---|---|
| 0 | Fundação (env, app, server, logs, health, testes) | ✅ |
| 1 | Domínio CRM (leads, eventos, agenda, métricas) | ✅ |
| 2 | WhatsApp (whatsapp-web.js): sessão persistente, QR Code/status, recebimento, grupos/menções ao Axis, proteção contra loops (responder só quando mencionado; ignorar mensagens próprias; ID de grupo configurável, não hardcoded) | ⬜ próximo passo |
| 3 | IA: adapter Ollama via interface, classificação, saída estruturada, conversation memory (docs/13), tool calling, fallback | ⬜ |
| 4 | Integrações Google Calendar / Sheets como adapters isolados | ⬜ |
| 5 | API/painel: auth, endpoints admin, React separado | ⬜ |
| 6 | Produção: Docker, VPS, backups, observabilidade | ⬜ |

**Próximo passo imediato: iniciar Fase 2 (WhatsApp).**

## 6. Regras de desenvolvimento (docs/11, 14, 10, 12)

- TypeScript strict, ESM, uma responsabilidade por arquivo
- Controllers finos; services testáveis; repositories isolam persistência; adapters nas fronteiras
- Sem abstrações prematuras (interfaces só onde há troca real); erros explícitos; funções pequenas
- AI nunca acessa banco direto; nenhuma operação crítica depende só da confiança do LLM; validar toda saída estruturada; limitar ações às tools registradas; sanitizar logs
- Toda nova capability precisa de: contrato + validação + service + teste
- Definition of Done (docs/14): contrato TS, validação, service, repo/teste/tratamento de erro/logs/docs, sem fragilidade textual do LLM, sem secrets, `pnpm typecheck` e `pnpm test` passando
- `.env` nunca commitado; config centralizada em `src/config/env.ts`

## 7. Workflow com agentes (docs/12)

Desenvolvimento conduzido por agentes de código em etapas pequenas:

ler docs → inspecionar código → propor plano → implementar UMA etapa → testar/lint/typecheck → corrigir → registrar.

Nunca pedir "construir tudo de uma vez".

## 8. Comandos úteis

```bash
pnpm dev          # tsx watch --env-file=.env src/server.ts
pnpm build        # tsc
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint src tests
pnpm format       # prettier
pnpm test         # vitest run
node generate-tree.js   # regenera axis-rewrite-docs_tree.txt
```

## 9. Pendências observadas nesta análise

- [ ] Criar primeiro commit (git está sem histórico)
- [ ] Definir `OLLAMA_MODEL` no `.env`
- [ ] Iniciar Fase 2: integração WhatsApp (whatsapp-web.js) atrás de adapter
