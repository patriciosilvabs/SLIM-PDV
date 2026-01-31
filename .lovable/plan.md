# Plano de Implementação - PDV Pizzaria

## ✅ API de Integração para CPD Externo (CONCLUÍDO)

### Implementado:

1. **Edge Functions:**
   - `production-api` - API REST para CPD consultar demanda, ingredientes e metas
   - `production-webhook` - Webhook para CPD enviar notificações de envios

2. **Banco de Dados:**
   - Tabela `production_api_keys` - Armazena chaves de API por tenant
   - Tabela `production_api_logs` - Logs de requisições

3. **Interface:**
   - `ProductionApiSettings` - UI em Configurações → Sistema → API de Produção

4. **Configurações:**
   - Menu "API de Produção" adicionado em Configurações
   - Link "Produção" removido do menu principal (integração é via API externa)

---

## Endpoints da API

Base URL: `https://pgfeffykhanujyqymmir.supabase.co/functions/v1`

### GET /production-api?action=demand
Retorna demanda de produção baseada em estoque vs metas do dia.

### GET /production-api?action=ingredients  
Retorna lista de ingredientes com níveis de estoque.

### GET /production-api?action=targets
Retorna metas diárias por dia da semana.

### POST /production-webhook
Recebe envios do CPD e atualiza estoque automaticamente.

---

## Autenticação

Todas as requisições requerem header `X-API-KEY` com chave válida.
Chaves são geradas em: Configurações → Sistema → API de Produção
