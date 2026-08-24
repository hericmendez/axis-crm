# Contexto de Desenvolvimento — Axis CRM

> Arquivo de memória de trabalho. Atualizar a cada sessão para facilitar a retomada por agentes/devs.

## 1. Objetivo do projeto

**Axis CRM** (`package.json` name: `axis-crm`, v0.1.0) — rewrite de um CRM existente cujo núcleo é um **assistente comercial conversacional para WhatsApp**. O assistente interpreta linguagem natural (LLM em nuvem via adapter Groq; Ollama descartado como plano principal, mantido só como possível fallback futuro) e executa operações de CRM: leads, agenda, eventos de venda e métricas.

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

Git: branch `main` com histórico de commits (fases 0–2 + hardening + adapter Groq). Ver `git log --oneline`.

### Concluído

**Fases 0 e 1** (~1.7k linhas em src+tests):

- `src/config/env.ts`: env carregada/validada num único módulo via Zod, cacheada (`getEnv`)
- `src/app.ts` / `src/server.ts`: Express + pino-http, graceful shutdown (SIGINT/SIGTERM, timeout 10s), handlers de unhandledRejection/uncaughtException, conexão Mongo
- **Domínio Lead completo**: model (telefone único), repository (CRUD, paginação, agregações), service com regras de negócio (normalização de telefone, duplicidade → 409, `dataConversao` só com status VENDIDO, auto-set na venda), controller fino com validação Zod, rotas `/api/leads`
- **Eventos**: model/service/repository — criar evento aplica efeitos no lead; ação compensatória se a atualização do lead falhar
- **Agenda**: `GET /api/agenda`; **Métricas**: `GET /api/metricas`
- Health check, error handler / not-found middlewares, `AppError`, utilitário de telefone
- **Hardening de segurança**: API key (`x-api-key`), helmet, rate limit HTTP (120 req/min/IP), limite de payload 100kb, limites nos validators Zod

**Adapter Groq (início antecipado da Fase 3)**: `src/types/ai.ts` (`LLMProvider`, saída estruturada ACTION|CHAT validada por Zod), `src/ai/providers/groq.provider.ts`, `src/ai/llm.factory.ts`. Modelo default `openai/gpt-oss-120b`; latência real medida ~874ms.

**Fase 2 — WhatsApp**: ver checkpoint detalhado na seção 12. Resumo: adapter whatsapp-web.js isolado, filtro de mensagens, boundary de saída (`WhatsAppClient`) e rate limiter concorrência-seguro prontos; autenticação real VERIFICADA com número dedicado (2026-08-24).

### Não existe ainda

- Fase 3 completa: ConversationService, AI Orchestrator, router de intenção, tool calling, memória conversacional
- `src/integrations/` (Google Calendar/Sheets) — Fases 4–6 pendentes

## 5. Roadmap (docs/00-roadmap.md)

| Fase | Escopo | Status |
|---|---|---|
| 0 | Fundação (env, app, server, logs, health, testes) | ✅ |
| 1 | Domínio CRM (leads, eventos, agenda, métricas) | ✅ |
| 1.5 | Hardening de segurança (API key, helmet, rate limit, limites de payload/validação) | ✅ |
| 2 | WhatsApp: adapter, filtro, boundary de saída prontos; **autenticação real verificada** ✅ (número dedicado) | 🔶 checkpoint |
| 3 | IA: adapter Groq ✅ antecipado; faltam ConversationService, AI Orchestrator, router de intenção, tool calling, memória (docs/13), fallback Ollama | 🔶 parcial |
| 4 | Integrações Google Calendar / Sheets como adapters isolados | ⬜ |
| 5 | API/painel: auth, endpoints admin, React separado | ⬜ |
| 6 | Produção: Docker, VPS, backups, observabilidade | ⬜ |

**Próximos passos imediatos:** (a) ~~autenticação real~~ ✅ concluída; próximo: Fase 3 — encadear mensagens aceitas ao pipeline de IA (independente do WhatsApp).

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
- [ ] Encadear mensagens aceitas ao pipeline de IA (Fase 3)

### Fase 2 etapa 2 — boundary de saída (concluída)

- `src/types/whatsapp.ts`: interface `WhatsAppClient { sendText(chatId, text): Promise<void> }` — única forma de a aplicação enviar mensagens; nenhum módulo fora de `src/whatsapp/whatsapp.adapter.ts` importa whatsapp-web.js
- `whatsapp.service.ts`: `setClient`/`clearClient` + `sendMessage(chatId, text)` que valida client registrado e status `conectado` (→ AppError 503), campos vazios (→ 400), rate limiter (→ 429) e converte falha do provider em AppError 502 sem vazar erro interno
- `send-rate-limiter.ts`: limite em memória de ~3s entre envios (proteção anti-banimento, separado do rate limit HTTP)
- `whatsapp.adapter.ts`: implementa `WhatsAppClient`; registra no evento `ready`, desregistra no `disconnected` e no `stop()`
- Testes: `tests/unit/whatsapp-send.test.ts` (7 casos com mock da interface, sem whatsapp-web.js)
- Arquitetura: server.ts → adapter → WhatsAppClient ← service; AI layer (Fase 3) dependerá apenas do service

Verificação: typecheck, lint e **100 testes** passando.

### Fase 2 micro-etapa — rate limiter de envio concorrência-seguro

- **Race condition confirmada**: `canSendNow()` (leitura) e `markSent()` (escrita pós-await) eram operações separadas; duas chamadas concorrentes a `sendMessage` passavam ambas pela checagem antes de qualquer `markSent`, enviando duas mensagens em sequência imediata.
- **Correção**: `send-rate-limiter.ts` agora expõe `tryAcquire()` atômico — reserva o slot no mesmo instante da checagem e retorna função de `release` que restaura o timestamp anterior. Sucesso mantém o bloqueio de ~3s; falha do provider chama `release()` e permite novo envio imediato.
- Testes novos: 2 envios concorrentes via `Promise.allSettled` (apenas 1 chega ao client, outro recebe 429); falha do provider libera a reserva para envio imediato; teste de intervalo migrado para fake timers.
- Verificação: typecheck, lint e **102 testes** passando.

### CHECKPOINT Fase 2 (2026-08-24) — autenticação real VERIFICADA

**Concluído (código):**
- Adapter de entrada whatsapp-web.js com sessão persistente (LocalAuth), QR, status e graceful shutdown
- Filtro de mensagens puro/testável (anti-loop, grupos autorizados configuráveis, menções)
- Boundary de saída: interface `WhatsAppClient` + `whatsapp.service.sendMessage()`
- Rate limiter de envio concorrência-seguro (reserva atômica; falha libera slot)
- Tratamento de erros do provider (502 sem vazamento interno)
- **106 testes** unitários/integração; whatsapp-web.js importado apenas pelo adapter (verificado por grep)
- Script de integração one-shot: `scripts/whatsapp-outbound-test.ts` (envia via service, não via wwjs)

**Verificado em ambiente real (número dedicado +55 16 99168-3518):**
- Autenticação real por QR com a conta WhatsApp Business dedicada ✅
- Identidade confirmada via log `WhatsApp autenticado como` (`client.info.wid.user`) ✅
- Persistência LocalAuth: múltiplos restarts restauraram a sessão sem novo QR ✅
  - Atenção: kill não-graceful do Chrome deixa `SingletonLock` em `.wwebjs_auth/session/` e a próxima inicialização **trava em `conectando`** — remover os arquivos `Singleton*` resolve
- Conta adicionada ao grupo alvo "Axis CRM - Grazi (DEV TEST)" ✅
- Mensagens reais de entrada verificadas (grupo autorizado, anti-loop fromMe) ✅
- Menção real ao Axis processada e aceita ✅ (ver abaixo: LID)
- Envio outbound real verificado via `scripts/whatsapp-outbound-test.ts` → mensagem chegou ao grupo; eco `fromMe` corretamente ignorado ✅

**Descobertas importantes da sessão real (2026-08-24):**

1. **Menções usam LID, não número telefônico.** Com o endereçamento novo do WhatsApp,
   `msg.mentionedIds` contém identificadores `@lid` (ex.: `257256360804483@lid`) cujos dígitos
   **não derivam** de `AXIS_NUMBER` — comparar só por número é insuficiente. O corpo cru da
   mensagem traz a menção literalmente como `@<LID>` (por isso o fallback textual `/@axis\b/i`
   raramente casa). Solução: `FilterConfig.selfIds` recebe `AXIS_NUMBER` **e**
   `WHATSAPP_SELF_LID` (env nova); comparação por dígitos contra qualquer identificador próprio.
   Como obter o LID: log diagnóstico ou enviar uma menção real ao Axis e ler `mentionedIds`.
2. **Sessão deve ser autenticada com a conta Business dedicada.** Na primeira autenticação o QR
   foi escaneado com a conta pessoal por engano: todas as mensagens do dev chegavam como
   `fromMe=true` e eram silenciosamente ignoradas (anti-loop correto). Sempre conferir o log
   `wid` no `ready` para validar a identidade.
3. **Puppeteer 24 quebra `msg.getChat()`/`getContact()`** (erro `ExecutionContext.#evaluate`).
   O adapter usa campos síncronos do `Message`: `msg.id.remote` = JID real do chat,
   `msg.id.participant`/`msg.author` = remetente em grupo. NÃO voltar a usar getChat/getContact.
4. **JIDs de grupo podem variar entre sessões** (`@g.us` vs `@lid` observados). O grupo alvo
   atual estabilizou como `120363411068401347@g.us`, configurado em `WHATSAPP_ALLOWED_GROUPS`.
5. `loading_screen` pode disparar DEPOIS de `ready` (sync de histórico) e rebaixava o status
   para `conectando` para sempre — corrigido: não rebaixa se já `conectado`.
6. `status@broadcast`/`@newsletter`/`@broadcast` são rejeitados pelo filtro ("chat não suportado").

**Próximos passos da Fase 3:** encadear mensagens aceitas ao ConversationService → AI Orchestrator.

## 11. Pendências

- [ ] Monitorar disponibilidade de modelos na Groq (nomes mudam; 404 = modelo descontinuado)
- [x] Autenticação real do WhatsApp ✅ (2026-08-24 — ver checkpoint na seção 12)
- [ ] Fase 3 completa: ConversationService, AI Orchestrator, router de intenção, tool calling, memória conversacional (docs/13)
- [ ] Adapter Ollama (fallback local)

### Débito técnico da Fase 1 (aceito/adiado)

- [ ] Soft delete em `DELETE /api/leads` (eventos referenciam leads)
- [ ] `updateById` usa `$set` — não permite desmarcar campos (`$unset`)
- [ ] Garantir criação explícita de índices em produção (hoje depende de `autoIndex`)
- [ ] Rate limiters HTTP e de envio em memória — trocar por solução distribuída se houver múltiplas instâncias

## Comandos adicionais

```bash
pnpm perf:groq    # teste de latência real contra a Groq (requer GROQ_API_KEY no .env)
```
