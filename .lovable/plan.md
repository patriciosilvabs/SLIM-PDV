
# Plano: Fluxo do Botao DESPACHAR por Tipo de Pedido

## Problema

Atualmente, quando o usuario aperta "DESPACHAR" no card de despacho (`finalizeOrderFromStatus`), **todos os pedidos sao finalizados diretamente** (status `delivered`), independentemente do tipo. Pedidos de mesa deveriam ser movidos para a proxima estacao `order_status` (ex: "DESPACHO - MESA") em vez de serem finalizados.

## Solucao

Alterar o `finalizeOrderFromStatus` para verificar o `order_type` do pedido:

- **Mesa (`dine_in`)**: Move todos os itens para a proxima estacao `order_status` (com `sort_order` maior). Se nao houver proxima estacao, finaliza normalmente.
- **Delivery / Balcao**: Finaliza diretamente como `delivered` (comportamento atual).

## Mudancas

### 1. useKdsWorkflow.ts - `finalizeOrderFromStatus`

Modificar a mutacao para:

1. Buscar o `order_type` do pedido junto com os itens
2. Se for `dine_in`, buscar a proxima estacao `order_status` com `sort_order` maior que a estacao atual
3. Se encontrar proxima estacao, mover todos os itens para ela (em vez de finalizar)
4. Se nao encontrar, ou se nao for `dine_in`, manter o comportamento atual (finalizar como `delivered`)

### 2. KdsOrderStatusCard.tsx - Passar `order_type` no callback

O componente precisa passar o `order_type` junto ao chamar `onFinalize`, para que o workflow saiba qual fluxo seguir.

### 3. KdsProductionLineView.tsx - Adaptar handler

Atualizar `handleFinalizeOrder` para aceitar e repassar o `order_type` e o `stationId` atual.

### Detalhes tecnicos

No `finalizeOrderFromStatus`:

```text
1. Busca order com order_type
2. Identifica estacao atual (onde os itens estao)
3. Se order_type === 'dine_in':
   a. Busca proxima order_status com sort_order maior
   b. Se existe: move itens para la, atualiza status do pedido
   c. Se nao existe: finaliza normalmente
4. Se delivery/takeaway: finaliza normalmente (comportamento atual)
```

### Arquivos modificados

- `src/hooks/useKdsWorkflow.ts`
- `src/components/kds/KdsOrderStatusCard.tsx`
- `src/components/kds/KdsProductionLineView.tsx`
