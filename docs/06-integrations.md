# Integrações

Cada integração deve possuir adapter próprio.

```text
integrations/
├── ollama/
├── google-calendar/
├── google-sheets/
└── whatsapp/
```

## Ollama

A aplicação deve depender de uma interface, não do Ollama diretamente.

```ts
interface LLMProvider {
  generate(input: LLMInput): Promise<LLMOutput>;
}
```

Isso permite trocar Ollama por outro provider sem reescrever o domínio.

## Google

Calendar e Sheets devem ser services/adapters independentes.

Credenciais nunca devem ficar no código ou no Git.
