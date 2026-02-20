
# Plano: Despacho com Agrupamento

## Implementado

### 1. KdsProductionLineView.tsx - Single station view
- Quando a praça atribuída é `order_status`, usa `KdsOrderStatusCard` em vez de `KdsStationCard`
- Usa `readyOrdersInStatus` (dados reagrupados com todos os itens) em vez de `effectiveStationOrders`

### 2. KdsOrderStatusCard.tsx - Botão DESPACHAR
- Botão "DESPACHAR" grande no topo do card, perto do timer
- Botão fica opaco (`opacity-40`) e desabilitado até todos os itens do pedido chegarem
- Itens em produção aparecem opacos com badge "em produção"
- Itens que chegaram mostram badge "Chegou"
- Removido botão "Servir" individual por item (agora é apenas visual)

### Arquivos modificados
- `src/components/kds/KdsProductionLineView.tsx`
- `src/components/kds/KdsOrderStatusCard.tsx`
