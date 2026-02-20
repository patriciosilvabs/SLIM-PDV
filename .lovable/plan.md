

# Roteamento Inteligente KDS - Implementado

## Fluxo de Roteamento

```text
Pedido confirmado (is_draft → false)
  |
  v
Trigger verifica cada item:
  |
  ├── Item COM borda? → Praça "Preparando Massa e Borda"
  │                        |
  │                        v (operador aperta "Próximo")
  │                        → Praça de preparo com MENOR FILA (A ou B)
  │
  └── Item SEM borda? → Praça de preparo com MENOR FILA (A ou B) direto
                           |
                           v (operador aperta "Próximo")
                           → Despacho (order_status)
```

## O que foi feito

### 1. Banco de dados
- Dividiu "Preparando Recheio" em "Preparando Recheio A" e "Preparando Recheio B"
- Atualizou BANCADA B para apontar para a nova praça B
- Trigger `assign_station_on_order_confirm` agora faz roteamento inteligente:
  - Verifica border_keywords nos extras/notes do item
  - Itens com borda → praça de borda (prep_start)
  - Itens sem borda → praça de preparo com menor fila (item_assembly)
  - Todos os itens do mesmo pedido vão para a MESMA praça de preparo

### 2. Edge Function (kds-data)
- Novo action `smart_move_item`: roteamento inteligente server-side
  - prep_start → least-busy item_assembly
  - item_assembly → order_status (despacho)
  - Inclui load balancing e logging automático

### 3. Frontend
- `useKdsWorkflow.ts`: `moveItemToNextStation` agora usa roteamento inteligente
  - prep_start → busca item_assembly com menor fila
  - item_assembly → vai direto para despacho
- `useKdsDeviceData.ts`: novo mutation `smartMoveItem`
- `KDS.tsx`: device-only mode usa `smart_move_item` via edge function
- `KdsProductionLineView.tsx`: aceita `overrideSettings` para bypass de RLS
- `KdsStationCard.tsx`: aceita settings como props

### Praças configuradas
- **Preparando Massa e Borda** (sort_order: 0, prep_start) → BANCADA DE BORDAS
- **Preparando Recheio A** (sort_order: 1, item_assembly) → BANCADA A
- **Preparando Recheio B** (sort_order: 1, item_assembly) → BANCADA B
- **Despachado - Delivery/Retirada** (sort_order: 5, order_status) → DESPACHO DELIVERY
- **Despachado - Item Servido** (sort_order: 6, custom) → DESPACHO GARÇOM
