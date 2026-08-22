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

## 9. Sessão de 2026-08-22 — revisão da Fase 1 e correções

### Avaliação: substituir Ollama por LLM em nuvem
- Tecnicamente viável: arquitetura já isola via `interface LLMProvider`; recomendo manter **dois adapters** (ollama/cloud) selecionáveis via env (`LLM_PROVIDER`).
- Modelo deste chat (`ox-alpha`) **não tem API pública conhecida** — não serve diretamente para o backend.
- Riscos de nuvem: PII de leads saindo da máquina (conflito com docs/10 e LGPD), rate limit/cota em modelos free.
- **Recomendação de modelo free**: **Groq** (Llama 3.3 70B, `llama-3.3-70b-versatile`) — free tier generoso, rápido, endpoint OpenAI-compatible (adapter trivial). Alternativa: Google Gemini Flash (free tier maior, porém usa dados para treino no tier gratuito — pior para LGPD).

### Correções aplicadas na Fase 1 ("Fase 1.5")
1. ✅ Auth: middleware `apiKeyAuth` (`x-api-key`, env `API_KEY`; vazio = desabilitado em dev/teste, obrigatório em produção). `/health` é público. Testes em `tests/api-key.test.ts`.
2. ✅ `express.json({ limit: '100kb' })`
3. ✅ `helmet()` + rate limiting em memória (`rate-limit.middleware.ts`: 120 req/min por IP → 429)
4. ✅ Limites de tamanho nos validators Zod (nome/telefone/email/observações etc.)
5. ✅ Criado `.env.example`
6. ✅ `evento.service.create` agora tem ação compensatória: se a atualização do lead falha, o evento é removido (transação do Mongo exigiria replica set; registrado como opção futura)
7. ✅ Enum de status com fonte única (`LEAD_STATUS` importado nos validators)
8. ✅ Logger redact inclui header `x-api-key`

Verificação: `tsc --noEmit`, ESLint e 78 testes passando.

### Débito técnico restante (aceito/adiado)
- [ ] Soft delete em `DELETE /api/leads` (eventos referenciam leads)
- [ ] `updateById` usa `$set` — não permite desmarcar campos (`$unset`)
- [ ] Garantir criação explícita de índices em produção (hoje depende de `autoIndex`)
- [ ] Rate limiter em memória — trocar por solução distribuída se houver múltiplas instâncias

## 10. Sessão de 2026-08-22 (2) — adapter Groq/Llama 3.3 70B (início da Fase 3, antecipado)

Implementado antes da Fase 2, a pedido do usuário:

- `src/types/ai.ts`: `LLMProvider` (interface), `ChatMessage`, `CompletionRequest`, `INTENTS` (CRIAR_LEAD, ATUALIZAR_LEAD, CONSULTAR_AGENDA, REGISTRAR_EVENTO, CONVERSAR) e `structuredOutputSchema` (Zod: `mode ACTION|CHAT`, intent, confidence, parameters/response)
- `src/ai/providers/groq.provider.ts`: adapter Groq (endpoint OpenAI-compatible `api.groq.com`), modelo default `llama-3.3-70b-versatile`, temperature 0.1, `response_format: json_object`, system prompt que exige JSON estruturado, timeout 30s, extração tolerante de JSON (markdown/fence), validação Zod da saída; erros → AppError 502 sem vazar corpo
- `src/ai/llm.factory.ts`: `createLLMProvider()` seleciona provider via env `LLM_PROVIDER=groq|ollama` (ollama ainda não implementado — Fase 3 completa virá depois)
- Env novas: `LLM_PROVIDER` (default groq), `GROQ_API_KEY`, `GROQ_MODEL`
- Testes: `tests/unit/groq.provider.test.ts` (fetch mockado: ACTION/CHAT, markdown, intent inválida, erro HTTP/rede); perf local em `tests/performance/llm.perf.test.ts` (p95 de overhead < 50ms em 100 chamadas mockadas; schema > 1000 ops/s)
- **Performance real (executada)**: `pnpm perf:groq` com `openai/gpt-oss-120b`, 5 chamadas: latência média **874ms**, p50 964ms, max 1172ms. Modos ACTION e CHAT classificados corretamente.
- **Importante**: `llama-3.3-70b-versatile` foi **descontinuado pela Groq** (404). Default alterado para `openai/gpt-oss-120b` em env, `.env.example`, testes e script (2026-08-22).
- Teste local de overhead (`tests/performance/llm.perf.test.ts`) passando: p95 < 50ms mockado; schema > 1000 ops/s.

Verificação: typecheck, lint e 86 testes passando.

## 12. Sessão de 2026-08-22 (3) — Fase 2: WhatsApp (etapa 1 concluída)

Implementado:

- Deps: `whatsapp-web.js` + `qrcode-terminal` (puppeteer aprovado em `pnpm-workspace.yaml`, `onlyBuiltDependencies`)
- Env novas (`.env.example` atualizado): `WHATSAPP_ENABLED` (default false), `WHATSAPP_ALLOWED_GROUPS` (IDs separados por vírgula; vazio = todos os grupos), `AXIS_NUMBER` (número do próprio Axis para detectar menções)
- `src/whatsapp/message-filter.ts`: **função pura e testável** com as regras dos docs/05 — ignora mensagens próprias (anti-loop), restringe grupos autorizados (configurável, nada hardcoded), exige menção ao Axis em grupo (`mentionedIds` contendo AXIS_NUMBER ou regex `/@axis\b/i` no texto); mensagens privadas não exigem menção
- `src/whatsapp/whatsapp.service.ts`: estado (status/QR) + `handleIncomingMessage` que aplica o filtro e, hoje, apenas loga a mensagem aceita (TODO Fase 3: encaminhar ao ConversationService → AI Orchestrator)
- `src/whatsapp/whatsapp.adapter.ts`: Client whatsapp-web.js com `LocalAuth` persistente (`WHATSAPP_SESSION_PATH`), eventos qr/loading/ready/disconnected, handler de `message_create`; `start()`/`stop()`
- Rota `GET /api/whatsapp/status` → `{status, qr}` (status: desconectado|aguardando_qr|conectando|conectado)
- `server.ts`: inicia adapter se `WHATSAPP_ENABLED=true`; encerra no graceful shutdown
- Testes: `tests/unit/message-filter.test.ts` (7 casos: anti-loop, grupo não autorizado, sem menção, menção por número, menção textual @axis, falso positivo @axiss rejeitado via word boundary, DM sem menção)

Verificação: typecheck, lint e **93 testes** passando.

### Próximos passos da Fase 2
- [ ] Autenticar sessão real (rodar com WHATSAPP_ENABLED=true e escanear QR)
- [ ] Envio de respostas (método send no adapter atrás de interface)
- [ ] Rate limit próprio p/ envio no WhatsApp (evitar banimento)
- [ ] Encadear mensagens aceitas ao pipeline de IA (Fase 3)

## 13. Pendências

- [x] Baseline de latência real medido (874ms médio com gpt-oss-120b)
- [ ] Monitorar disponibilidade de modelos na Groq (nomes mudam; 404 = modelo descontinuado)
- [ ] Adapter Ollama (Fase 3 completa: ConversationService, AI Orchestrator, router de intenção, tool calling, memória docs/13)
- [ ] Iniciar Fase 2: integração WhatsApp (whatsapp-web.js) atrás de adapter
