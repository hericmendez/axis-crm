# ADR-002 — Internal Tools Layer

## Status

Accepted

## Context

O Axis CRM precisa executar operações de domínio (criar lead, atualizar lead, registrar evento, consultar agenda) a partir de intenções interpretadas pelo LLM. Inicialmente, o Intent Router delegava diretamente para os Domain Services.

Dois padrões arquiteturais foram considerados:

1. **Native Tool Calling** — o LLM seleciona e invoca tools via API de function calling do provedor
2. **Internal Tools** — abstrações de aplicação chamadas exclusivamente por código, nunca pelo LLM

O sistema atual tem 5 intents e 3 Domain Services. A complexidade é baixa.

## Decision

Manter Intent Router + Internal Tools. NÃO implementar Native Tool Calling.

Internal Tools são abstrações de aplicação com interface `InternalTool<P>`:
- Chamadas exclusivamente por código (Intent Router)
- Nenhum loop de agente
- Nenhum registro dinâmico
- Nenhum tool selection pelo LLM
- Cada tool encapsula uma operação de domínio

## Alternatives Considered

1. **Native Tool Calling (OpenAI/Groq function calling)**:
   - Rejeitado porque: adiciona 2+ chamadas LLM por mensagem (~1748ms+, 2x custo), quebra abstração LLMProvider, requer suporte por provedor, e não traz benefício claro com 5 intents
   - reconsiderar quando: intents > 10 ou multi-step orchestration necessária

2. **Mantiver chamada direta Intent Router → Service (sem Tools)**:
   - Rejeitado porque: tools adicionam camada de teste, desacoplamento, e preparação para futuras operações complexas

3. **Agent loop com tool selection dinâmica**:
   - Rejeitado porque: complexidade desnecessária, latência adicional, sem caso de uso atual

## Consequences

Positivas:
- Intent Router desacoplado de Domain Services
- Tools testáveis isoladamente
- Preparação para operações futuras (criar lead + registrar evento, etc.)
- Custo e latência preservados (1 chamada LLM por mensagem)
- LLMProvider permanece abstraído

Negativas:
- Mais um módulo no caminho do fluxo
- Entity resolution permanece no Router (não nas Tools)
- CONVERSAR não tem tool (case especial no Router)

## Revisão

Revisar quando:
- Número de intents > 10
- Operações multi-step necessárias (ex: criar lead + agendar reunião)
- Novo provedor com capacidades de tool calling superiores
- Custo de latência se torna menos relevante

## Related Documentation

- docs/00-roadmap.md
- docs/13-conversation-memory.md
- ADR-001-ai-orchestrator.md
