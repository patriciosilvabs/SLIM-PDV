

# Correcao: Bancada de Borda mostrando colunas extras + Roteamento Preparo → Despacho

## Problema 1: Bancada de Borda visualizando colunas das Bancadas de Preparo

**Causa raiz identificada**: Quando o dispositivo tem `assignedStationId` definido, o componente `KdsProductionLineView` deveria mostrar APENAS a coluna dessa praca (modo single-station). Porem, a busca do `currentStation` pode falhar em cenarios especificos, fazendo o sistema renderizar o modo "visao geral" (todas as colunas).

**Correcao**: Adicionar validacao robusta no `KdsProductionLineView` para garantir que o modo single-station sempre funcione quando ha `assignedStationId`. Tambem filtrar os itens exibidos para mostrar apenas itens que pertencem a essa praca, eliminando qualquer possibilidade de ver dados de outras pracas.

## Problema 2: Preparo marcando "proximo" nao envia para Despacho

**Causa raiz identificada**: O roteamento inteligente (`smart_move_item` na Edge Function e `getSmartNextStation` no hook) ja tem a logica `item_assembly → order_status`. Porem, a estacao "Despachado - Item Servido na mesa" (ID `2ebd0f1a`) esta com tipo `custom` em vez de `order_status`, o que impede o sistema de encontra-la como estacao de despacho. Alem disso, o `findDispatchStation` busca apenas estacoes do tipo `order_status`.

**Correcao**: O roteamento ja funciona para estacoes com tipo `order_status`. A estacao "Despachado - Delivery/Retirada" (tipo `order_status`) recebe os itens corretamente. Para a estacao "Despachado / Garcom", sera necessario verificar se o tipo precisa ser alterado ou se o roteamento deve considerar ambos os tipos.

---

## Mudancas Tecnicas

### 1. `src/components/kds/KdsProductionLineView.tsx`

- Quando `settings.assignedStationId` estiver definido, FORCAR modo single-station mesmo que `activeStations.find()` falhe (buscar a estacao em `overrideStations` como fallback)
- Adicionar log de depuracao temporario para identificar se o `assignedStationId` chega corretamente
- Garantir que a renderizacao NUNCA mostre colunas de outras pracas quando ha uma praca atribuida

### 2. `src/pages/KDS.tsx`

- Garantir que o `assignedStationId` do dispositivo (de `deviceAuth.stationId`) seja priorizado sobre qualquer outro valor
- Quando em device-only mode, usar `deviceAuth.stationId` diretamente em vez de depender de `kdsSettings.assignedStationId` (que pode ser null se o localStorage nao foi salvo corretamente)

### 3. `supabase/functions/kds-data/index.ts` (Edge Function)

- Verificar e corrigir a funcao `findDispatchStation` para garantir que encontra a estacao de despacho correta
- Adicionar verificacao de que a estacao "Despachado / Garcom" (tipo `custom`) tambem e considerada como destino apos item_assembly, se necessario

### 4. `src/hooks/useKdsWorkflow.ts`

- Garantir que `getSmartNextStation` para `item_assembly` sempre encontra a estacao de despacho (order_status)
- Adicionar fallback caso nenhuma estacao order_status seja encontrada

---

## Resumo das Correcoes

| Problema | Causa | Solucao |
|----------|-------|---------|
| Borda ve colunas extras | `assignedStationId` pode nao estar sendo usado corretamente | Priorizar `deviceAuth.stationId` e forcar modo single-station |
| Preparo nao vai para Despacho | Roteamento funciona mas pode ter tipo de estacao incorreto | Verificar tipos de estacao e corrigir a busca de dispatch |

