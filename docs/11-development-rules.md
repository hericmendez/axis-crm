# Regras de desenvolvimento

1. TypeScript strict.
2. ESM.
3. Um arquivo deve ter uma responsabilidade clara.
4. Controllers finos.
5. Services testáveis.
6. Repositories isolam persistência.
7. Integrações usam adapters.
8. AI não possui acesso direto ao banco.
9. Nenhuma operação crítica depende apenas de confiança do LLM.
10. Não criar abstrações prematuramente; criar interfaces nos pontos de troca real.
11. Preferir funções pequenas.
12. Erros devem ser explícitos e rastreáveis.
13. Toda nova capability deve possuir:
   - contrato
   - validação
   - service
   - teste
