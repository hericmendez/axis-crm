# Segurança

- Nunca commitar API keys, OAuth secrets ou tokens.
- Validar toda saída estruturada do LLM.
- Aplicar autorização antes de cada operação.
- Limitar ações disponíveis ao conjunto de tools registrado.
- Não permitir que o modelo escolha URLs arbitrárias.
- Sanitizar logs.
- Não registrar conteúdo sensível sem necessidade.
- Proteger endpoints administrativos.
- Separar credenciais da Grazi das credenciais do desenvolvedor.
