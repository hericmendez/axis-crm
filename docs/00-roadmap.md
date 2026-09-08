# Roadmap

## Fase 0 — Fundação

- TypeScript
- Express
- configuração por ambiente
- logging
- tratamento global de erros
- MongoDB
- health check

## Fase 1 — Domínio CRM

- Lead
- agenda
- vendas
- métricas
- repositories
- services
- validações

## Fase 2 — WhatsApp

- sessão persistente
- QR Code/status
- recebimento de mensagens
- grupos
- menções ao Axis
- proteção contra loops

## Fase 3 — IA

- adapter de LLM (Groq)
- classificação de mensagens
- saída estruturada
- conversation memory
- internal tools
- fallback conversacional
- memória longa (summary)

## Fase 4 — Integrações Google (COMPLETA)

- Per-user Google OAuth
- Resource Provisioning automática
- Domain Projection (Calendar + Sheets)
- Failure & Retry Strategy
- Runtime Validation

## Fase 5 — Assistente de Agenda

### Objetivo

Transformar o Axis de um sistema que apenas **cria** eventos no Calendar em um assistente que **lê,Consulta,corrige e gerencia** a agenda do usuário.

### Problema

A ferramenta `CONSULTAR_AGENDA` hoje consulta apenas o MongoDB.
O Google Calendar é used exclusivamente como projeção (write-only).
O assistente não consegue:
- ler eventos existentes no Calendar
- sugerir horários disponíveis
- detectar conflitos
- corrigir/agendar considerando agenda real

### PASSOs

- **5.1** Calendar Query Adapter — adapter de leitura do Google Calendar
- **5.2** Agenda Avançada — consulta combinada Calendar+MongoDB, disponível no chat
- **5.3** Vinculação Conversa→Lead — associação automática lead↔conversa
- **5.4** Correção de Eventos — cancelamento e reagendamento via chat

### Princípios

- MongoDB continua fonte de verdade para domínio
- Calendar é authoritative para disponibilidade (read-through)
- Separação entre consulta (read) e projeção (write)
- Failure isolation mantida

### Fora do escopo

- Multi-usuário WhatsApp
- Projeções assíncronas
- Reconciliação automática
- Fallback Ollama
- API/painel React
- Produção/Docker

## Fase 6 — API/painel

- autenticação
- endpoints de configuração
- status do WhatsApp
- QR Code
- integrações
- React separado

## Fase 7 — Produção

- Docker
- VPS
- logs
- health/readiness
- backups
- segurança
- observabilidade

---

## Decisões Arquiteturais — Google Integration

### Fonte de verdade

MongoDB permanece como fonte de verdade canônica para domínio (leads, eventos).

### Projeções

Google Calendar e Google Sheets são projeções de domínio — não fontes de verdade para dados de negócio.

### Consulta de agenda

Para disponibilidade e leitura de agenda, Google Calendar é authoritative.
O assistente deve ler do Calendar quando o usuário pergunta sobre sua agenda.

### Per-user OAuth

Per-user OAuth fornece acesso a recursos Google proprietários por usuário.

### Falhas Google

Falhas Google não causam rollback de transações MongoDB.

---

## PASSOs Implementados

```
PASSO 1   — Per-user Google OAuth              ✅
PASSO 2   — Google Resource Provisioning        ✅
PASSO 3.1 — Domain Model Preparation           ✅
PASSO 3.2 — Calendar Projection                ✅
PASSO 3.3 — Calendar Reschedule/Cancel         ✅
PASSO 3.4 — Sheets Projection                  ✅
PASSO 3.5 — Failure & Retry Strategy           ✅
PASSO 3.6 — Runtime Validation                 ✅
PASSO 3.7 — Roadmap/Architecture Audit         ✅
PASSO 3.8 — Auto-Provisioning                  ✅
```
