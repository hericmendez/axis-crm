# Workflow com Agentes de Código

Este projeto é desenvolvido com agentes de código em pequenas etapas.

> **Atualização de contexto:** o plano original previa uso de LLM local via Ollama
> como assistente de desenvolvimento. Isso **não é mais o caso**: o projeto usa
> **agentes de código** (Codex/opencode) e a IA do produto roda em **nuvem**
> (adapter Groq, `openai/gpt-oss-120b`). O adapter Ollama permanece apenas como
> possível fallback futuro da Fase 3, sem data prevista.

## Regra principal

O agente de código deve trabalhar em pequenas etapas.

Fluxo recomendado:

```text
1. Ler documentação
2. Inspecionar código existente
3. Propor plano
4. Implementar uma etapa
5. Rodar testes/lint/typecheck
6. Corrigir
7. Registrar mudança
```

Não pedir ao agente para "construir o Axis inteiro" em uma única tarefa.

## Contexto para o agente

Sempre disponibilizar:

- README
- arquitetura
- domínio
- regras de desenvolvimento
- tarefa atual
- `docs/development_context.md` (memória de trabalho atualizada)

## Primeira milestone

Concluída (fases 0–2). Ver roadmap em `docs/00-roadmap.md` e estado atual em
`docs/development_context.md`.
