# API inicial

## Health

`GET /health`

Resposta:

```json
{
  "status": "ok"
}
```

## WhatsApp

- `GET /api/whatsapp/status`
- `GET /api/whatsapp/qr`
- `POST /api/whatsapp/reconnect`
- `POST /api/whatsapp/logout`

## Leads

- `GET /api/leads`
- `GET /api/leads/:id`
- `POST /api/leads`
- `PATCH /api/leads/:id`
- `DELETE /api/leads/:id`

## Integrações

- `GET /api/integrations`
- `POST /api/integrations/google`
- `DELETE /api/integrations/google`

Endpoints são sugestões iniciais; implementar somente quando o domínio estiver pronto.
