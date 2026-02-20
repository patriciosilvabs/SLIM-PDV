

# Corrigir Flicker no Despacho e Roteamento por Tipo de Pedido

## Problema Identificado

Existem **2 problemas** na logica de roteamento do KDS:

### Problema 1: Item some e volta (flicker) nas bancadas de Despacho
Quando voce clica "Proximo" em uma estacao do tipo `order_status` (ex: "Despachado - Delivery / Retirada"), o sistema tenta encontrar a proxima estacao usando `getSmartNextStation`, mas essa funcao **nao sabe lidar com estacoes order_status**. Ela cai no caso `else` (default), que procura em `productionStations` -- mas estacoes order_status sao EXCLUIDAS dessa lista. O resultado: o item volta para a MESMA estacao ou para a primeira order_status, criando um loop infinito de "some e volta".

### Problema 2: Nao diferencia pedidos de Mesa vs Delivery no Despacho
Atualmente, o roteamento nao considera o `order_type` do pedido. Pedidos de Mesa deveriam ir de "Despachado - Embalagem / Mesa" para "Despachado - Item Servido na mesa" (garcom). Pedidos de Delivery/Retirada deveriam ser finalizados ou seguir fluxo diferente.

## Solucao

### 1. Corrigir `getSmartNextStation` no hook `useKdsWorkflow.ts`

Adicionar tratamento para estacoes `order_status`:
- Buscar o `order_type` do pedido (dine_in, delivery, takeaway)
- Se estiver em uma estacao order_status com sort_order menor, verificar se existe OUTRA estacao order_status com sort_order MAIOR
- Para pedidos de **Mesa (dine_in)**: mover para a proxima estacao order_status (ex: "Despachado - Item Servido na mesa")
- Para pedidos de **Delivery/Takeaway**: marcar como `done` (finalizado) -- nao precisa ir para garcom

### 2. Corrigir a Edge Function `kds-data/index.ts` (smart_move_item)

Aplicar a mesma logica de roteamento por order_type na edge function (usada pelo modo dispositivo):
- Buscar o `order_type` do pedido via `order_items.order_id -> orders.order_type`
- Se estacao atual for `order_status`:
  - **dine_in**: buscar proxima estacao order_status por sort_order
  - **delivery/takeaway**: marcar item como `done`, status `delivered`

### 3. Atualizar o optimistic update no `onMutate`

O optimistic update precisa saber tambem o destino correto para nao causar flicker:
- Passar o `order_type` junto com os parametros da mutacao
- Calcular o destino otimista corretamente (proxima order_status ou done)

### 4. Manter a protecao anti-flicker existente

A logica de `markItemAsRecentlyMoved` + `isRecentlyMoved` ja implementada continua funcionando como camada extra de seguranca.

## Detalhes Tecnicos

### Mudancas em `src/hooks/useKdsWorkflow.ts`

```text
getSmartNextStation(currentStationId, orderType?)
  ├── prep_start → least-busy item_assembly (sem mudanca)
  ├── item_assembly → order_status (sem mudanca)  
  ├── order_status + dine_in → proxima order_status por sort_order
  ├── order_status + delivery/takeaway → null (done)
  └── default → sequential (sem mudanca)
```

- A interface da mutacao `moveItemToNextStation` recebera um campo opcional `orderType`
- O `onMutate` usara `orderType` para calcular o destino otimista correto

### Mudancas em `supabase/functions/kds-data/index.ts`

Na acao `smart_move_item`:
- Buscar `order_type` do pedido associado ao item
- Adicionar caso `order_status` no roteamento:
  - dine_in: buscar proxima order_status station com sort_order maior
  - delivery/takeaway: targetStationId = null (done)

### Mudancas em componentes que chamam `moveItemToNextStation`

- `KdsStationCard` e outros componentes que chamam `onMoveToNext` precisarao passar o `orderType` junto

## Resumo das Mudancas

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useKdsWorkflow.ts` | Roteamento order_status com order_type + optimistic update correto |
| `supabase/functions/kds-data/index.ts` | Roteamento order_status com order_type na edge function |
| `src/components/kds/KdsStationCard.tsx` | Passar order_type no callback onMoveToNext |
| `src/components/kds/KdsProductionLineView.tsx` | Passar order_type ao chamar handleMoveToNext |

