
# Plano: API de Integração para Sistema CPD Externo

## Contexto

O cenário atual implementou uma estrutura de produção interna entre tenants do mesmo sistema. O que você precisa é diferente:

- **CPD = Sistema Externo** (ERP, planilha, software próprio)
- **Comunicação Bidirecional** via API REST + Webhooks
- Este PDV deve expor endpoints para o CPD consultar e enviar dados

---

## Arquitetura da Integração

```text
+------------------+       Webhook (Push)        +------------------+
|                  | <--------------------------- |                  |
|   PDV Lovable    |                              |   CPD Externo    |
|   (Este App)     |                              |   (Seu Sistema)  |
|                  | ---------------------------> |                  |
+------------------+       API REST (Pull)        +------------------+
```

### Fluxo de Dados

1. **CPD consulta PDV** (Pull): O CPD chama nossa API para buscar demanda de produção
2. **CPD notifica PDV** (Push): O CPD envia webhook quando produção é enviada

---

## O que será criado

### 1. Edge Function: `production-api`

API REST pública para o CPD consultar dados das lojas.

Endpoints:
- `GET /production-api?action=demand` - Lista demanda de produção
- `GET /production-api?action=ingredients` - Lista ingredientes e estoque
- `GET /production-api?action=targets` - Lista metas diárias

Autenticação via `X-API-KEY` configurável por tenant.

### 2. Edge Function: `production-webhook`

Recebe notificações do CPD quando produção é enviada.

Eventos suportados:
- `SHIPMENT_CREATED` - CPD informa que enviou ingredientes
- `SHIPMENT_RECEIVED` - (opcional) confirmação de recebimento

### 3. Tabela: `production_api_keys`

Armazena chaves de API para autenticação do CPD.

Colunas:
- `tenant_id` - Qual loja
- `api_key` - Chave secreta
- `name` - Nome identificador
- `is_active` - Se está ativa
- `permissions` - Quais endpoints pode acessar

### 4. Interface: Configurações de Integração

Tela em Configurações para:
- Gerar/revogar chaves de API
- Ver URL do webhook para configurar no CPD
- Testar conexão
- Logs de requisições

---

## Detalhes Técnicos

### Formato da API de Demanda

```json
GET /production-api?action=demand
Headers: X-API-KEY: sua-chave-aqui

Response:
{
  "success": true,
  "date": "2026-01-31",
  "day_of_week": 5,
  "store": {
    "id": "uuid",
    "name": "Loja Centro"
  },
  "demand": [
    {
      "ingredient_id": "uuid",
      "ingredient_name": "Massa de Pizza",
      "unit": "kg",
      "current_stock": 5,
      "target_stock": 20,
      "to_produce": 15,
      "status": "critical"
    }
  ]
}
```

### Formato do Webhook de Envio

```json
POST /production-webhook
Headers: X-API-KEY: sua-chave-aqui

Body:
{
  "event": "SHIPMENT_CREATED",
  "shipment": {
    "external_id": "CPD-12345",
    "items": [
      {
        "ingredient_name": "Massa de Pizza",
        "ingredient_id": "uuid-opcional",
        "quantity": 15,
        "unit": "kg"
      }
    ],
    "shipped_at": "2026-01-31T14:30:00Z",
    "notes": "Lote 45"
  }
}
```

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/production-api/index.ts` | API REST para consulta |
| `supabase/functions/production-webhook/index.ts` | Webhook para receber envios |
| `src/components/settings/ProductionApiSettings.tsx` | UI de configuração |
| `src/hooks/useProductionApiKeys.ts` | Hook para gerenciar chaves |

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/settings/SettingsSidebar.tsx` | Adicionar menu "API de Produção" |
| `src/pages/Settings.tsx` | Adicionar rota para ProductionApiSettings |
| `supabase/config.toml` | Registrar novas edge functions (verify_jwt = false) |

## Migração de Banco

Criar tabela `production_api_keys` com RLS apropriado.

---

## O que será removido/revertido

1. **Remover** link "Produção" do menu principal (`PDVLayout.tsx`)
2. **Manter** a página `/production` mas ela será usada apenas internamente se necessário
3. **Manter** as tabelas de targets e shipments - elas serão usadas pela API
4. **Remover** os triggers de baixa automática de estoque no `order_items` (a baixa será feita pelo CPD ou manualmente)

---

## Documentação para o CPD

Após implementação, você receberá:

1. **URL Base da API**: `https://[project-id].supabase.co/functions/v1/`
2. **Endpoints disponíveis**
3. **Exemplos de código** (Python, JavaScript, cURL)
4. **Webhook URL** para configurar no sistema CPD

---

## Ordem de Execução

1. Criar migração para tabela `production_api_keys`
2. Criar edge function `production-api`
3. Criar edge function `production-webhook`
4. Criar UI de configuração
5. Atualizar menu e remover itens incorretos
6. Documentar endpoints
