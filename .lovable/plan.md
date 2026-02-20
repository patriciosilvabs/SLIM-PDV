
# Plano: Reagrupar Pedido no Despacho

## Problema

Quando um pedido com multiplos itens e "explodido" nas bancadas de producao, os itens chegam ao despacho em momentos diferentes. Atualmente, o card do pedido aparece no despacho assim que o PRIMEIRO item chega, mostrando apenas esse item e permitindo despachar um pedido incompleto.

## Solucao

O pedido deve aparecer no despacho somente quando TODOS os itens estiverem prontos (chegaram na estacao `order_status` ou tem `station_status = 'done'`). Enquanto houver itens ainda em producao, o pedido nao deve aparecer na coluna de despacho.

Adicionalmente, sera exibido um indicador visual de "Aguardando X itens" caso o pedido apareca parcialmente.

## Mudancas

### 1. KdsProductionLineView.tsx - Filtro `readyOrdersInStatus`

Atualizar o `useMemo` para:
- Verificar se TODOS os `order_items` do pedido estao na estacao `order_status` ou com `station_status === 'done'`
- Ao montar o card, passar TODOS os itens do pedido (nao apenas os que estao na estacao), para que o card mostre o pedido completo reagrupado

### 2. KdsOrderStatusCard.tsx - Indicador de itens pendentes

Ajustar o card para:
- Mostrar todos os itens do pedido reagrupados
- Desabilitar o botao "Servir Mesa" / "Finalizar Pedido" ate que todos os itens estejam presentes
- Mostrar badge "Aguardando X itens em producao" quando houver itens faltando

### 3. KdsProductionLineReadOnly.tsx - Mesma logica

Aplicar a mesma correcao no componente read-only para consistencia.

## Detalhes Tecnicos

### readyOrdersInStatus (KdsProductionLineView.tsx, linhas 194-221)

Logica atual:
```
order.order_items?.every(item => 
  item.current_station_id === orderStatusStation.id || item.station_status === 'done'
)
```

Esta logica ja verifica todos os itens, mas o problema e que na hora de montar os `items` do card (linhas 209-218), ele filtra apenas os itens NA estacao de despacho, excluindo itens com `station_status === 'done'`. A correcao sera passar todos os itens do pedido para o card quando o pedido estiver pronto.

Tambem sera necessario garantir que pedidos com itens ainda em bancadas de producao (`item_assembly`, `prep_start`) NAO aparecem, mesmo que o `order.status` seja `ready`.

### KdsOrderStatusCard.tsx

O card ja tem a logica de `allServed` que desabilita o botao. A mudanca principal e garantir que todos os itens aparecem na lista, incluindo os que ja estao `done`.

### Arquivos modificados

- `src/components/kds/KdsProductionLineView.tsx`
- `src/components/kds/KdsOrderStatusCard.tsx`
- `src/components/kds/KdsProductionLineReadOnly.tsx`
