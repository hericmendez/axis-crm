# ADR-001 — AI Orchestrator

## Status

Accepted

## Context

O Axis CRM precisa conectar o pipeline de mensagens WhatsApp ao LLM para interpretar intenções do usuário e executar operações de domínio (leads, eventos, agenda). O adapter Groq já existe mas não está conectado ao fluxo de entrada. O ConversationService já persiste mensagens mas não processa intenções.

A Fase 3 etapa 2 (WhatsApp → ConversationService) foi concluída. A etapa 3 é o AI Orchestrator.

## Decision

Criar um AI Orchestrator que coordena: contexto conversacional → LLM → roteamento de intenções → execução de serviços de domínio → resposta ao usuário.

Arquitetura implementada:

```
WhatsApp Adapter
    ↓
WhatsApp Service (filtro + persistência)
    ↓
Conversation Service (getRecentMessages)
    ↓
AI Orchestrator (contexto → LLM → resultado)
    ↓
LLM Provider (abstração existente)
    ↓
Intent Router (validação → entity resolution → service call)
    ↓
Domain Services (leadService, eventoService, metricasService)
    ↓
Response Builder (resultado → mensagem amigável)
    ↓
WhatsApp Service (persistência + envio)
```

Componentes criados:
- `src/ai/orchestrator.ts`: coordena o fluxo; depende de LLMProvider e IntentRouterDeps via injecção
- `src/ai/intent-router.ts`: valida parâmetros, resolve entidades, delega services
- `src/ai/response-builder.ts`: converte resultados em mensagens amigáveis (função pura)
- `src/ai/errors.ts`: tipos de erro discriminados

Correção de bug:
- `src/whatsapp/whatsapp.adapter.ts:62`: adicionado `await` em `handleIncomingMessage()` para que o try/catch existente funcione corretamente com promises assíncronas

Entity Resolution:
- leadId → busca direta por ObjectId
- telefone → busca direta por telefone
- leadRef (nome) → busca exata case-insensitive via `findByName()`
- 0 resultados → ENTITY_NOT_FOUND
- 1 resultado → resolve
- >1 resultados → AMBIGUOUS_ENTITY (usuário escolhe)

## Alternatives Considered

1. **Lógica direta no whatsapp.service.ts**: rejeitado — violaria separação de responsabilidades e tornaria o service monolítico.

2. **Classe AIOrchestrator com injeção de dependência completa**: rejeitado — abstração desnecessária para o escopo atual; factory function é suficiente.

3. **Prompt com tool calling nativo do LLM**: rejeitado — adiciona complexidade ao provider, quebra a abstração LLMProvider, e torna o sistema dependente de capabilities específicas de cada provedor.

4. **Memória de curto prazo via embeddings**: rejeitado — complexidade desnecessária para esta etapa; janela de 10 mensagens recentes é suficiente.

## Consequences

Positivas:
- Fluxo testável (orchestrator com LLM mockado, intent-router com services mockados)
- Provider abstraído (troca Groq→Ollama não afeta orchestrator)
- Services de domínio não alterados
- Erros discriminados permitem respostas apropriadas ao usuário
- Bug de await corrigido

Negativas:
- Mais um módulo no caminho do fluxo
- Entity resolution por nome requer busca no banco (performance aceitável para volume atual)
- Multi-turno depende da capacidade do LLM de manter contexto via janela de mensagens

## Decisões Futuras (fora do escopo)

- Idempotência/deduplicação de mensagens WhatsApp
- Google Calendar integration (Fase 4)
- Fallback Ollama
- Memória longa (summary quando histórico crescer)
- Soft delete em leads
- Rate limiting distribuído

## Related Documentation

- docs/development_context.md
- src/types/ai.ts (StructuredOutput, INTENTS)
- src/ai/llm.factory.ts (provider abstraction)
