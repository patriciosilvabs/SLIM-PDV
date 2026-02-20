

# Plano: Distribuir Itens do Pedido em Bancadas Diferentes

## Problema Identificado

Quando um pedido tem mais de um item, o sistema deveria "explodir" o pedido e distribuir cada item para bancadas de produção diferentes (balanceamento de carga), mas todos os itens estão ficando na mesma bancada ("Preparando Massa e Borda").

**Causa raiz:** O trigger do banco de dados `assign_station_on_order_confirm` tem a logica correta para distribuir itens sem borda para bancadas `item_assembly` (Recheio A / Recheio B), mas na pratica ambos os itens estao indo para a bancada `prep_start`. Alem disso, itens adicionados DEPOIS da confirmacao do pedido (via modal "Adicionar Itens") nao passam pelo trigger, ficando sem bancada.

## Solucao

### 1. Corrigir o Trigger de Distribuicao

Atualizar a funcao `assign_station_on_order_confirm()` para garantir que:
- Itens COM borda vao para a primeira estacao de producao (`prep_start`)
- Itens SEM borda vao diretamente para a bancada `item_assembly` menos ocupada (Recheio A ou Recheio B)
- Quando nao houver estacoes `item_assembly`, todos vao para a primeira estacao

### 2. Criar Trigger para Itens Adicionados Depois

Criar um novo trigger `trigger_assign_station_on_item_insert` na tabela `order_items` que:
- Dispara quando um novo item e inserido
- Verifica se o pedido ja foi confirmado (`is_draft = false`)
- Se sim, atribui automaticamente o item a bancada correta usando a mesma logica de balanceamento

### 3. Atualizar o Workflow no Frontend

Ajustar `useKdsWorkflow.ts` para que a funcao `initializeOrderForProductionLine` tambem use a logica de distribuicao inteligente ao inves de enviar todos para a primeira bancada.

---

## Detalhes Tecnicos

### Migracao SQL - Trigger Atualizado

```sql
-- Trigger para novos itens adicionados a pedidos ja confirmados
CREATE OR REPLACE FUNCTION public.assign_station_on_item_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_draft BOOLEAN;
  order_tenant UUID;
  borda_station_id UUID;
  all_prep_ids UUID[];
  prep_counts INT[];
  num_preps INT;
  min_idx INT;
  min_val INT;
  i INT;
  has_border BOOLEAN;
  border_kws TEXT[];
  kds_settings RECORD;
  combined_text TEXT;
  kw TEXT;
BEGIN
  -- Verificar se o pedido ja esta confirmado
  SELECT is_draft, tenant_id INTO order_draft, order_tenant
  FROM orders WHERE id = NEW.order_id;
  
  -- Se ainda e rascunho, o trigger principal cuida
  IF order_draft = TRUE OR order_draft IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Se ja tem station atribuida, ignorar
  IF NEW.current_station_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Mesma logica de distribuicao do trigger principal
  -- (buscar keywords, estacoes, verificar borda, atribuir)
  ...
  
  RETURN NEW;
END;
$function$;
```

### Alteracao no Frontend

Em `useKdsWorkflow.ts`, a funcao `initializeOrderForProductionLine` sera atualizada para usar `findLeastBusyPrepStation()` ao inves de enviar todos os itens para `activeStations[0]`.

### Arquivos Modificados

- `supabase/migrations/` - Nova migracao com trigger atualizado + trigger de insert
- `src/hooks/useKdsWorkflow.ts` - Atualizar `initializeOrderForProductionLine` para distribuir itens

