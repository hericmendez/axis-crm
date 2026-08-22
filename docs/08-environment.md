# Variáveis de ambiente

Nunca commitar `.env`.

Exemplo:

```env
NODE_ENV=development
PORT=3000

MONGO_URI=mongodb://...

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=<modelo-local>

WHATSAPP_SESSION_PATH=.wwebjs_auth

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

A configuração deve ser carregada e validada em um único módulo.

Não espalhar `process.env` pelo projeto.
