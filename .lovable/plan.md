
# Plano: Corrigir Despacho Mesa e Historico

## Problema Identificado

A estacao "Despacho - Mesa" esta cadastrada com `station_type = 'custom'` no banco de dados, mas o codigo procura apenas estacoes do tipo `'order_status'` para rotear pedidos de mesa. Por isso:

1. Pedidos de mesa despachados em "Despacho - Geral" sao finalizados diretamente em vez de irem para "Despacho - Mesa"
2. O historico de "Despacho - Geral" nao mostra os despachos porque o log `completed` so e criado quando o pedido e movido corretamente (e nao quando e finalizado direto)

## Solucao

### 1. Migracao SQL - Corrigir tipo da estacao

Alterar o `station_type` de "Despacho - Mesa" de `custom` para `order_status`:

```text
UPDATE kds_stations 
SET station_type = 'order_status' 
WHERE id = '2ebd0f1a-6b97-4f83-8dd6-c70ffc3ceeb0';
```

Isso faz com que o codigo existente ja reconheca "Despacho - Mesa" como proxima estacao de despacho.

### 2. useKdsWorkflow.ts - Garantir log `completed` no despacho

Quando `finalizeOrderFromStatus` finaliza um pedido (delivery/takeaway ou ultima estacao), ele ja cria o log `completed`. Porem, quando move para a proxima estacao (dine_in), tambem precisa invalidar o cache do historico apos a mutacao. Adicionar invalidacao de `kds-station-history` no `onSuccess`.

### 3. KdsStationHistory.tsx - Invalidar cache apos despacho

Adicionar invalidacao do query `kds-station-history` no `onSuccess` do `finalizeOrderFromStatus` para que o historico atualize imediatamente apos o despacho.

## Arquivos modificados

- Migracao SQL (novo)
- `src/hooks/useKdsWorkflow.ts` - adicionar invalidacao de `kds-station-history` no onSuccess do finalizeOrderFromStatus
