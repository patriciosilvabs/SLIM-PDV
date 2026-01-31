

# Plano: Sistema de Automacao de Estoque e Producao para Multi-Lojas (SISPRO)

## Resumo Executivo

Este plano implementa o sistema completo de automacao de estoque e producao descrito no dossie, adaptando a arquitetura existente do PDV para suportar:

- **Metas diarias por dia da semana** para cada loja (tenant)
- **Baixa automatica de insumos** quando pedidos sao criados
- **Dashboard de producao (CPD)** mostrando demanda em tempo real
- **Isolamento por loja** com visao consolidada para o centro de producao

O sistema ja possui as bases necessarias:
- Tabela `ingredients` para cadastro de insumos
- Tabela `product_ingredients` para fichas tecnicas (mapeamento De/Para)
- Tabela `stock_movements` para historico de movimentacoes
- Hook `useIngredients` com mutations para movimentacao

---

## Fase 1: Estrutura de Dados (Migrations SQL)

### 1.1 Nova Tabela: `ingredient_daily_targets`

Armazena a meta de estoque ideal por loja, insumo e dia da semana.

```text
Campos:
- id (uuid, PK)
- tenant_id (uuid, FK -> tenants) - A loja
- ingredient_id (uuid, FK -> ingredients) - O insumo
- day_of_week (integer 0-6) - Domingo=0 ... Sabado=6
- target_quantity (numeric) - Quantidade ideal
- created_at, updated_at
- UNIQUE(tenant_id, ingredient_id, day_of_week)
```

Exemplo de dados:
| Loja    | Insumo   | Dia     | Meta  |
|---------|----------|---------|-------|
| Aleixo  | Massa    | Sabado  | 250   |
| Aleixo  | Massa    | Terca   | 80    |

### 1.2 Modificar Tabela: `stock_movements`

Adicionar campo `order_id` para rastreabilidade das baixas automaticas:

```text
- order_id (uuid, nullable) - Referencia ao pedido que gerou a baixa
```

### 1.3 Nova Tabela: `unmapped_sales`

Para itens vendidos sem mapeamento na ficha tecnica (De/Para):

```text
- id (uuid, PK)
- tenant_id (uuid)
- order_id (uuid)
- order_item_id (uuid)
- product_name (text)
- quantity (integer)
- created_at
- resolved (boolean, default false)
```

### 1.4 Nova Tabela: `production_shipments`

Historico de envios do CPD para as lojas:

```text
- id (uuid, PK)
- from_tenant_id (uuid) - CPD
- to_tenant_id (uuid) - Loja destino
- ingredient_id (uuid)
- quantity (numeric)
- shipped_by (uuid)
- shipped_at (timestamp)
- received_at (timestamp, nullable)
- received_by (uuid, nullable)
```

### 1.5 Database View: `v_production_demand`

View SQL que calcula automaticamente a demanda de producao:

```sql
CREATE VIEW v_production_demand AS
SELECT 
  t.tenant_id,
  ten.name as store_name,
  t.ingredient_id,
  i.name as ingredient_name,
  i.unit,
  t.target_quantity as ideal_stock,
  COALESCE(i.current_stock, 0) as current_stock,
  GREATEST(0, t.target_quantity - COALESCE(i.current_stock, 0)) as to_produce
FROM ingredient_daily_targets t
JOIN tenants ten ON ten.id = t.tenant_id
JOIN ingredients i ON i.id = t.ingredient_id AND i.tenant_id = t.tenant_id
WHERE t.day_of_week = EXTRACT(DOW FROM NOW())
  AND t.target_quantity > COALESCE(i.current_stock, 0);
```

### 1.6 Triggers para Automacao

**Trigger 1: `auto_deduct_stock_on_order_item`**
- Dispara quando um order_item e inserido
- Verifica se o pedido NAO e rascunho (is_draft = false)
- Consulta `product_ingredients` para pegar a ficha tecnica
- Para cada ingrediente: registra saida e atualiza current_stock
- Se nao houver ficha tecnica, registra em `unmapped_sales`

**Trigger 2: `restore_stock_on_cancellation`**
- Dispara quando order_item.status muda para 'cancelled'
- Reverte as movimentacoes de saida relacionadas
- Registra entrada com nota "Estorno - Cancelamento"

---

## Fase 2: Interface de Configuracao de Metas

### 2.1 Nova Secao em Configuracoes: "Metas de Producao"

Atualizar `SettingsSidebar.tsx`:
- Adicionar item `production-targets` com icone `Target`
- Grupo: "Sistema" ou novo grupo "Producao"

### 2.2 Componente: `ProductionTargetsSettings.tsx`

Interface em formato de grade semanal:

```text
+------------------+------+------+------+------+------+------+------+
| Ingrediente      | Dom  | Seg  | Ter  | Qua  | Qui  | Sex  | Sab  |
+------------------+------+------+------+------+------+------+------+
| Massa            | 60   | 80   | 80   | 90   | 100  | 150  | 250  |
| Mussarela (kg)   | 10   | 15   | 15   | 18   | 20   | 30   | 50   |
+------------------+------+------+------+------+------+------+------+
```

Funcionalidades:
- Clique na celula para editar valor
- Botao "Copiar de Outro Dia" para replicar configuracao
- Validacao: valores >= 0

### 2.3 Hook: `useProductionTargets.ts`

```typescript
// Funcoes principais:
- useProductionTargets(ingredientId?) - Lista metas
- useProductionTargetMutations() - CRUD de metas
  - upsertTarget(tenant_id, ingredient_id, day_of_week, target_quantity)
  - copyDayTargets(fromDay, toDay)
```

---

## Fase 3: Dashboard de Producao (CPD)

### 3.1 Nova Pagina: `/production`

Adicionar rota em `App.tsx`:
```tsx
<Route path="/production" element={<RequireTenant><Production /></RequireTenant>} />
```

### 3.2 Componente: `Production.tsx`

Dashboard principal com duas visualizacoes:

**Visao Cards (Por Loja):**
```text
+------------------------+
|  ALEIXO               |
|  Massa: 210 a produzir |
|  Mussa: 15kg          |
|  [!] Critico          |
+------------------------+
```

**Visao Tabela Consolidada:**
```text
| Insumo      | Aleixo | Unidade 2 | TOTAL |
|-------------|--------|-----------|-------|
| Massa       | 210    | 45        | 255   |
| Mussarela   | 15kg   | 8kg       | 23kg  |
```

Recursos:
- Atualizacao em tempo real via Supabase Realtime
- Filtros: Por loja, por ingrediente
- Cores de alerta: Verde (ok), Amarelo (<=50% meta), Vermelho (<20% meta)
- Botao "Confirmar Envio" para registrar producao

### 3.3 Hook: `useProductionDemand.ts`

```typescript
const { data, isLoading, refetch } = useProductionDemand({
  tenantId?: string,  // Filtrar por loja (ou todas se omitido)
  date?: Date         // Default: hoje
});

// Retorna:
interface ProductionDemandItem {
  tenant_id: string;
  store_name: string;
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  ideal_stock: number;
  current_stock: number;
  to_produce: number;
}
```

### 3.4 Componentes de Suporte

- `LojaDemandCard.tsx` - Card individual por loja
- `ShipmentConfirmDialog.tsx` - Modal para confirmar envio
- `UnmappedSalesAlert.tsx` - Alerta de itens sem ficha tecnica

---

## Fase 4: Integracao com Webhook CardapioWeb

### 4.1 Atualizar Edge Function `cardapioweb-webhook`

Adicionar logica apos criar order_items (linha ~332):

```typescript
// Apos criar order item, verificar e aplicar baixa de estoque
if (mapping?.local_product_id) {
  // Buscar ficha tecnica do produto
  const { data: productIngredients } = await supabase
    .from('product_ingredients')
    .select('ingredient_id, quantity')
    .eq('product_id', mapping.local_product_id);
  
  for (const pi of productIngredients || []) {
    // Registrar saida automatica
    await deductStock(pi.ingredient_id, item.quantity * pi.quantity, newOrder.id);
  }
} else {
  // Registrar em unmapped_sales
  await supabase.from('unmapped_sales').insert({
    tenant_id: integration.tenant_id,
    order_id: newOrder.id,
    order_item_id: orderItem.id,
    product_name: item.name,
    quantity: item.quantity
  });
}
```

---

## Fase 5: Permissoes Granulares

Adicionar novas permissoes ao sistema existente:

```sql
-- Adicionar ao enum permission_code
ALTER TYPE permission_code ADD VALUE 'production_view';
ALTER TYPE permission_code ADD VALUE 'production_manage';
ALTER TYPE permission_code ADD VALUE 'targets_manage';
```

Descricoes:
- `production_view` - Visualizar dashboard de producao
- `production_manage` - Confirmar envios e fazer ajustes
- `targets_manage` - Configurar metas diarias de producao

---

## Arquivos a Criar

### Migrations SQL (via tool):
1. Tabela `ingredient_daily_targets` + RLS
2. Campo `order_id` em `stock_movements`
3. Tabela `unmapped_sales` + RLS
4. Tabela `production_shipments` + RLS
5. View `v_production_demand`
6. Trigger `auto_deduct_stock_on_order_item`
7. Trigger `restore_stock_on_cancellation`
8. Novas permissoes

### Novos Hooks:
- `src/hooks/useProductionTargets.ts`
- `src/hooks/useProductionDemand.ts`
- `src/hooks/useProductionShipments.ts`
- `src/hooks/useUnmappedSales.ts`

### Novos Componentes:
- `src/components/settings/ProductionTargetsSettings.tsx`
- `src/components/production/ProductionDashboard.tsx`
- `src/components/production/LojaDemandCard.tsx`
- `src/components/production/ShipmentConfirmDialog.tsx`
- `src/components/production/UnmappedSalesAlert.tsx`
- `src/components/production/ConsolidatedDemandTable.tsx`

### Nova Pagina:
- `src/pages/Production.tsx`

### Modificacoes:
- `src/App.tsx` - Adicionar rota /production
- `src/components/settings/SettingsSidebar.tsx` - Adicionar secao metas
- `src/pages/Settings.tsx` - Adicionar case para metas
- `supabase/functions/cardapioweb-webhook/index.ts` - Baixa automatica
- `src/components/layout/PDVLayout.tsx` - Adicionar menu Producao

---

## Fluxo Operacional Completo

```text
VENDA
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

REPOSICAO
+------------------+
| CPD Produz       |
+------------------+
       |
       v
  Confirma Envio
       |
       v
+------------------+
| Entrada Estoque  |
| Loja: +210       |
+------------------+
       |
       v
+------------------+
| Dashboard Limpo  |
| "A Produzir: 0"  |
+------------------+
```

---

## Consideracoes de Seguranca (RLS)

### ingredient_daily_targets
- SELECT: `belongs_to_tenant(tenant_id)`
- ALL: `belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin')`

### unmapped_sales
- SELECT: `belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin')`
- INSERT: Sistema (via trigger)

### production_shipments
- SELECT: `belongs_to_tenant(from_tenant_id) OR belongs_to_tenant(to_tenant_id)`
- INSERT/UPDATE: Permissao `production_manage`

---

## Estimativa de Implementacao

| Fase | Descricao | Complexidade |
|------|-----------|--------------|
| 1 | Migrations SQL + Triggers | Media |
| 2 | UI Metas (Settings) | Baixa |
| 3 | Dashboard Producao | Alta |
| 4 | Integracao Webhook | Baixa |
| 5 | Permissoes | Baixa |

Recomendo iniciar pela **Fase 1** (estrutura de dados) seguida da **Fase 2** (configuracao de metas) para permitir testes manuais antes de automatizar.

