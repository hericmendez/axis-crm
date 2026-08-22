# Testes

Prioridade:

1. unitários para services
2. testes do AI parser com mensagens fixas
3. testes de repositories
4. integração MongoDB
5. integração WhatsApp em ambiente de desenvolvimento
6. testes HTTP

## Casos importantes de IA

- criação de lead
- atualização de venda
- pergunta aberta
- pergunta fora do escopo
- mensagem ambígua
- contexto com pronomes
- ausência de dados obrigatórios
- tentativa de prompt injection
- mensagem própria do Axis
- mensagem sem menção em grupo

O comportamento esperado deve ser testado sem depender de uma resposta textual específica do LLM quando isso não for necessário.
