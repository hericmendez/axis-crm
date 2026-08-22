# Axis CRM — Rewrite

Assistente comercial conversacional para WhatsApp.

## Stack

- Node.js
- Express
- TypeScript
- MongoDB + Mongoose
- whatsapp-web.js
- Google Calendar / Sheets
- LLM local via Ollama
- Arquitetura MVC + Services + Repositories

## Princípios

1. O LLM interpreta intenção, contexto e conversa; não acessa banco diretamente.
2. Regras de negócio ficam no backend.
3. Operações externas ficam atrás de services/adapters.
4. Toda ação sensível é validada antes da execução.
5. Conversa e execução são separadas.
6. O projeto deve continuar executável sem depender de um frontend.

## Fluxo principal

WhatsApp → Controller → AI Orchestrator → Intent/Tool → Service → Repository/Integration → resposta

## Começo do desenvolvimento

Consulte `docs/00-roadmap.md` e siga os documentos em ordem.
