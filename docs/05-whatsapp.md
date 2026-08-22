# WhatsApp

O WhatsApp deve ser tratado como uma integração, não como o núcleo do domínio.

## Responsabilidades

- autenticação
- QR Code
- status
- recebimento
- envio
- identificação de grupos
- menções
- prevenção de loop

## Regras

O Axis não deve responder automaticamente a toda mensagem.

Modo inicial:

```text
mensagem de grupo
  ↓
é uma mensagem do Axis? → ignora
  ↓
Axis foi mencionado? → processa
  ↓
caso contrário → ignora
```

O ID do grupo não deve ser hardcoded como regra central.

A identidade do Axis deve permitir configurar número/conta posteriormente.
