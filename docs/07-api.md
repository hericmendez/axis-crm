# API — guia humano

O contrato canônico da API é:

```text
docs/api/openapi.yaml   (OpenAPI 3.1)
```

Ele é validado automaticamente em `tests/unit/openapi-contract.test.ts`
(toda rota Express registrada precisa existir na spec, `$ref`s precisam
resolver). Se este guia e a spec divergirem, a spec — e acima dela o
código — prevalece; reporte a divergência em vez de improvisar.

## Como autenticar

* Painel (humano): `POST /api/auth/login` → `Authorization: Bearer <JWT>`.
* Integrações (máquina): header `x-api-key`.
* Qualquer um dos dois estabelece a identidade do tenant server-side
  (`req.userId`). Nunca envie `userId`: ele é ignorado.

## Regras que valem para tudo

* Sem identidade → `401`. Recurso de outro tenant → `404` (nunca 403).
* Erros têm a forma `{ "error": "<mensagem>" }`.
* `GET /api/agenda` e `GET /api/whatsapp/status` são legados congelados;
  use `GET /api/v1/agenda` e `GET /api/v1/whatsapp/*`.
* Rate limits: 120 req/min por IP no geral; login/refresh têm limite próprio
  por IP+email (defaults: 20 por 15 min → 429).
* Fuso das agendas: `America/Sao_Paulo`.
