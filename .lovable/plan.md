

# SISPRO - Sistema de Automação de Estoque e Produção

## ✅ Status: IMPLEMENTADO

Este documento descreve o Sistema de Automação de Estoque e Produção (SISPRO), que está totalmente implementado.

---

## Funcionalidades Implementadas

### 1. Metas de Produção (Configurações)
- **Arquivo**: `src/components/settings/ProductionTargetsSettings.tsx`
- Grid semanal para configurar metas de estoque por ingrediente
- Copiar metas entre dias
- Acesso via Configurações → Metas de Produção

### 2. Dashboard de Produção
- **Arquivo**: `src/pages/Production.tsx`
- Visualização por loja e consolidada
- Indicadores de status (OK, Atenção, Crítico)
- Botão "Enviar" para registrar envios de produção
- Rota: `/production`

### 3. Sistema de Permissões
- **Permissões adicionadas**:
  - `production_view` - Acessar dashboard de produção
  - `production_manage` - Confirmar envios de produção
  - `targets_manage` - Gerenciar metas de produção
- Menu lateral filtrado por permissão

### 4. Baixa Automática de Estoque
- **Trigger**: `trigger_auto_deduct_stock_for_order_item`
- Quando um item de pedido é criado (não-rascunho):
  1. Busca ficha técnica (`product_ingredients`)
  2. Para cada ingrediente, cria movimentação de saída (`stock_movements`)
  3. Atualiza estoque atual (`ingredients.current_stock`)
  4. Se não houver ficha técnica, registra em `unmapped_sales`

### 5. Estorno em Cancelamentos
- **Trigger**: `trigger_restore_stock_on_cancellation`
- Quando um item é cancelado, o estoque é restaurado automaticamente

### 6. Vendas Sem Mapeamento
- **Componente**: `src/components/production/UnmappedSalesAlert.tsx`
- Alerta visual para itens vendidos sem ficha técnica configurada

---

## Tabelas do Banco de Dados

| Tabela | Descrição |
|--------|-----------|
| `ingredient_daily_targets` | Metas de estoque por dia da semana |
| `production_shipments` | Registro de envios de produção |
| `unmapped_sales` | Vendas de itens sem ficha técnica |
| `stock_movements` | Histórico de movimentações de estoque |

---

## Fluxo Operacional

1. **Configuração**: Admin define metas semanais em Configurações → Metas de Produção
2. **Monitoramento**: Dashboard `/production` mostra demanda em tempo real
3. **Produção**: CPD confirma envios, que atualizam o estoque
4. **Vendas**: Baixa automática via trigger quando pedidos são criados
5. **Alertas**: Sistema notifica sobre vendas sem mapeamento


