# Arquitetura

A aplicação usa MVC como estrutura de entrada HTTP, mas não coloca regra de negócio nos controllers.

```text
src/
├── app.ts
├── server.ts
├── config/
├── controllers/
├── routes/
├── models/
├── repositories/
├── services/
├── ai/
├── integrations/
├── whatsapp/
├── middlewares/
├── validators/
├── types/
└── utils/
```

## Responsabilidades

### Controllers

Recebem HTTP, validam entrada básica e delegam para services.

### Models

Representam persistência MongoDB/Mongoose.

### Repositories

Encapsulam acesso ao banco.

### Services

Contêm regras de negócio.

### AI

Interpreta linguagem e conversa. Nunca deve chamar Mongoose diretamente.

### Integrations

Adapters para WhatsApp, Calendar, Sheets e Ollama.

### Routes

Mapeiam HTTP para controllers.

## Regra de dependência

```text
Routes → Controllers → Services → Repositories/Integrations
                         ↑
                    AI Orchestrator
```

Models não devem ser importados pelos controllers.
