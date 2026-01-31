
# Plano: Sistema de Automacao de Estoque e Producao para Multi-Lojas

## Resumo Executivo

Este plano implementa o sistema completo de automacao de estoque descrito no dossie, adaptando a arquitetura existente do PDV para suportar:
- **Metas diarias por dia da semana** para cada loja
- **Baixa automatica de insumos** quando pedidos sao criados
- **Dashboard de producao** mostrando demanda em tempo real
- **Isolamento por loja** com visao consolidada para o CPD

---

## Fase 1: Estrutura de Dados

### 1.1 Nova Tabela: `ingredient_daily_targets` (Metas por Dia da Semana)

```text
Campos:
- id (uuid)
- tenant_id (uuid) - A "loja"
- ingredient_id (uuid) - O insumo
- day_of_week (integer 0-6) - Domingo=0, Segunda=1... Sabado=6
- target_quantity (numeric) - Quantidade ideal
- created_at, updated_at
- Constraint: UNIQUE(tenant_id, ingredient_id, day_of_week)
```

Esta tabela permite configurar metas diferentes para cada dia. Exemplo:
- Aleixo | Massa | Sabado | 250 unidades
- Aleixo | Massa | Terca | 80 unidades

### 1.2 Modificar Tabela: `stock_movements`

Adicionar campo `order_id` para rastreabilidade:
```text
- order_id (uuid, nullable) - Referencia ao pedido que gerou a baixa
```

### 1.3 Nova Tabela: `unmapped_sales` (Vinculos Pendentes)

Para items vendidos sem mapeamento De/Para:
```text
- id (uuid)
- tenant_id (uuid)
- order_id (uuid)
- order_item_id (uuid)
- product_name (text)
- quantity (integer)
- created_at
- resolved (boolean default false)
```

### 1.4 Database View: `v_production_demand`

View consolidada que calcula automaticamente a demanda de producao:
```sql
-- Pseudo-SQL
SELECT 
  tenant_id,
  tenant.name as loja,
  ingredient_id,
  ingredient.name,
  target_quantity as meta_ideal,
  current_stock as estoque_atual,
  (target_quantity - current_stock) as a_produzir
FROM ingredient_daily_targets
JOIN ingredients...
WHERE day_of_week = EXTRACT(DOW FROM NOW())
  AND (target_quantity - current_stock) > 0
```

---

## Fase 2: Logica de Baixa Automatica

### 2.1 Trigger: Baixa ao Criar Order Item

Criar trigger `auto_deduct_stock_on_order` que:
1. Quando um order_item e inserido E o pedido nao e rascunho
2. Consulta a tabela `product_ingredients` (ficha tecnica)
3. Para cada ingrediente, calcula: quantidade_item * fator_conversao
4. Registra a movimentacao como `exit` com referencia ao order_id
5. Atualiza `current_stock` do ingrediente

### 2.2 Edge Function: Webhook Handler Atualizado

Modificar `cardapioweb-webhook` para:
- Apos criar order_items, chamar funcao de baixa de estoque
- Registrar items sem mapeamento na tabela `unmapped_sales`

### 2.3 Tratamento de Cancelamentos

Trigger `restore_stock_on_cancellation`:
- Quando um order_item e cancelado, reverter a baixa
- Registrar movimentacao como `entry` com nota "Estorno - Cancelamento"

---

## Fase 3: Interface de Configuracao de Metas

### 3.1 Nova Secao em Configuracoes: "Metas de Producao"

Adicionar ao sidebar de Settings:
- Novo item: `production-targets` com icone Target

### 3.2 Componente: `ProductionTargetsSettings.tsx`

Interface em formato de grade semanal:
```text
+------------------+------+------+------+------+------+------+------+
| Ingrediente      | Dom  | Seg  | Ter  | Qua  | Qui  | Sex  | Sab  |
+------------------+------+------+------+------+------+------+------+
| Massa            | 60   | 80   | 80   | 90   | 100  | 150  | 250  |
| Mussarela (kg)   | 10   | 15   | 15   | 18   | 20   | 30   | 50   |
+------------------+------+------+------+------+------+------+------+
```

Features:
- Editar meta clicando na celula
- Copiar configuracao de um dia para outro
- Importar/exportar metas

---

## Fase 4: Dashboard de Producao (CPD)

### 4.1 Nova Pagina: `/production`

Dashboard principal mostrando:

**Visao por Loja (cards):**
```text
+------------------------+
|  ALEIXO               |
|  Massa: 210 a produzir |
|  Mussa: 15kg          |
|  [!] Critico          |
+------------------------+
```

**Visao Consolidada (tabela):**
```text
| Insumo      | Aleixo | Unidade 2 | Unidade 3 | TOTAL |
|-------------|--------|-----------|-----------|-------|
| Massa       | 210    | 45        | 80        | 335   |
| Mussarela   | 15kg   | 8kg       | 12kg      | 35kg  |
```

### 4.2 Recursos do Dashboard

- **Realtime updates** via Supabase subscriptions
- **Filtros**: Por loja, por periodo, por categoria de insumo
- **Cores de alerta**: Verde (ok), Amarelo (atencao), Vermelho (critico)
- **Botao "Confirmar Envio"**: Registra entrada de producao na loja

### 4.3 Hook: `useProductionDemand`

```typescript
// Retorna demanda de producao em tempo real
const { data, refetch } = useProductionDemand({
  tenantId?: string, // Filtrar por loja (ou ver todas)
  date?: Date        // Default: hoje
});
```

---

## Fase 5: Registro de Reposicao

### 5.1 Fluxo de Envio do CPD

1. CPD ve demanda consolidada
2. Produz os itens necessarios
3. Clica "Confirmar Producao" para cada loja
4. Sistema registra entrada (+quantidade) no estoque da loja
5. Dashboard atualiza e zera o alerta

### 5.2 Historico de Envios

Nova tabela `production_shipments`:
```text
- id (uuid)
- from_tenant_id (uuid) - CPD
- to_tenant_id (uuid) - Loja destino
- ingredient_id (uuid)
- quantity (numeric)
- shipped_by (uuid)
- shipped_at (timestamp)
- received_at (timestamp, nullable)
- received_by (uuid, nullable)
```

---

## Fase 6: Alertas e Notificacoes

### 6.1 Alertas de Estoque Critico

- Push notification quando estoque < 20% da meta
- Audio alert no dashboard (configuravel)

### 6.2 Relatorio de Perdas

Funcionalidade para detectar discrepancias:
- Sistema diz: 50 unidades
- Contagem fisica: 30 unidades
- Registrar ajuste com flag "perda"
- Dashboard de perdas para auditoria

---

## Fluxo Completo

```text
+-------------+     Webhook      +------------------+
| CardapioWeb | --------------> | PDV Slim         |
+-------------+                  +------------------+
       |                                |
       v                                v
  ORDER_CREATED                  Cria Order + Items
       |                                |
       |                                v
       |                         +------------------+
       |                         | Trigger: Baixa   |
       |                         | de Estoque       |
       |                         +------------------+
       |                                |
       v                                v
+------------------+            +------------------+
| Dashboard CPD    | <--------- | View: Demanda    |
| "A Produzir: 210"|            | de Producao      |
+------------------+            +------------------+
       |
       v
  Confirma Producao
       |
       v
+------------------+
| Entrada Estoque  |
| Loja: +210       |
+------------------+
```

---

## Arquivos a Criar/Modificar

### Novas Migrations SQL:
1. `create_ingredient_daily_targets.sql`
2. `add_order_id_to_stock_movements.sql`
3. `create_unmapped_sales.sql`
4. `create_production_shipments.sql`
5. `create_v_production_demand.sql`
6. `create_stock_triggers.sql`

### Novos Hooks:
1. `src/hooks/useProductionTargets.ts`
2. `src/hooks/useProductionDemand.ts`
3. `src/hooks/useProductionShipments.ts`
4. `src/hooks/useUnmappedSales.ts`

### Novos Componentes:
1. `src/components/settings/ProductionTargetsSettings.tsx`
2. `src/components/production/ProductionDashboard.tsx`
3. `src/components/production/LojaDemandCard.tsx`
4. `src/components/production/ShipmentConfirmDialog.tsx`
5. `src/components/production/UnmappedSalesAlert.tsx`

### Nova Pagina:
1. `src/pages/Production.tsx`

### Modificacoes:
1. `src/components/settings/SettingsSidebar.tsx` - Adicionar "Metas de Producao"
2. `src/pages/Settings.tsx` - Adicionar rota para metas
3. `src/App.tsx` - Adicionar rota /production
4. `supabase/functions/cardapioweb-webhook/index.ts` - Adicionar baixa automatica

---

## Consideracoes de Seguranca

### RLS Policies

- `ingredient_daily_targets`: Admins do tenant podem gerenciar
- `production_shipments`: Apenas tenants de origem/destino podem ver
- `unmapped_sales`: Apenas admins do tenant

### Permissoes Granulares

Adicionar novas permissoes:
- `production_view` - Ver dashboard de producao
- `production_manage` - Confirmar envios e ajustes
- `targets_manage` - Configurar metas diarias

---

## Proximos Passos Sugeridos

1. **Configuracao Multi-Tenant para CPD**: Definir como o CPD (centro de producao) tera visao de todas as lojas. Opcoes:
   - Um usuario com role especial que ve todos os tenants
   - Um tenant "master" que consolida os dados

2. **API CardapioWeb**: Verificar se todos os produtos estao mapeados na ficha tecnica

3. **Teste de Integracao**: Simular fluxo completo com pedidos de teste

