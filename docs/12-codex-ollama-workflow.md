# Workflow com Codex + Ollama

Este projeto será desenvolvido inicialmente com modelos locais.

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

## Primeira milestone

Criar somente:

- package.json
- tsconfig
- Express
- config
- health route
- logger
- error middleware
- estrutura MVC
- teste básico

Depois disso, avançar para MongoDB.
