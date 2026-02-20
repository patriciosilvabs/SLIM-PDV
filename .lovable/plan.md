
# Correcao: Pedidos nao aparecem no KDS

## Problema identificado

Existe uma falha na logica de atribuicao de estacoes KDS. O fluxo atual e:

1. Pedido e criado como **rascunho** (`is_draft: true`)
2. Itens sao inseridos no pedido
3. O trigger `auto_initialize_new_order_item` dispara, mas **ignora** itens de pedidos rascunho
4. Pedido e marcado como **confirmado** (`is_draft: false`)
5. Nenhum mecanismo reatribui os itens a primeira estacao KDS

Resultado: itens ficam com `current_station_id = NULL` e nunca aparecem em nenhum dispositivo KDS.

Isso afeta tanto a pagina de **Mesas** quanto o **Balcao**.

## Solucao

Criar um trigger no banco de dados que detecta quando `is_draft` muda de `true` para `false` na tabela `orders`, e automaticamente atribui todos os itens (que ainda nao tem estacao) a primeira estacao KDS ativa do tenant.

## Detalhes tecnicos

### 1. Novo trigger no banco: `assign_station_on_order_confirm`

Sera criada uma funcao + trigger na tabela `orders` que:

- Dispara em UPDATE quando `is_draft` muda de `true` para `false`
- Busca a primeira `kds_station` ativa (excluindo `order_status`) do mesmo `tenant_id`
- Atualiza todos os `order_items` do pedido que ainda tem `current_station_id IS NULL` para apontar para essa estacao com `station_status = 'waiting'`

```text
orders UPDATE (is_draft: true -> false)
       |
       v
  Buscar first_station (kds_stations WHERE tenant_id AND active AND !order_status)
       |
       v
  UPDATE order_items SET current_station_id = first_station, station_status = 'waiting'
  WHERE order_id = NEW.id AND current_station_id IS NULL
```

### 2. Migracao SQL

```sql
CREATE OR REPLACE FUNCTION public.assign_station_on_order_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  first_station_id UUID;
BEGIN
  -- Apenas quando is_draft muda de true para false
  IF OLD.is_draft = TRUE AND NEW.is_draft = FALSE THEN
    -- Buscar primeira estacao ativa do tenant
    SELECT id INTO first_station_id
    FROM kds_stations
    WHERE is_active = TRUE 
      AND station_type != 'order_status'
      AND tenant_id = NEW.tenant_id
    ORDER BY sort_order ASC
    LIMIT 1;
    
    IF first_station_id IS NOT NULL THEN
      -- Atribuir estacao a todos os itens sem estacao
      UPDATE order_items
      SET current_station_id = first_station_id,
          station_status = 'waiting'
      WHERE order_id = NEW.id
        AND current_station_id IS NULL
        AND (station_status IS NULL OR station_status = 'waiting');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_assign_station_on_confirm
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_station_on_order_confirm();
```

### 3. Nenhuma alteracao no codigo frontend

A correcao e 100% no banco de dados via trigger, garantindo que funcione independente de qual pagina criou o pedido (Mesas, Balcao, API externa, etc).
