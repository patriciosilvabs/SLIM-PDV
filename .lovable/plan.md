

# Plano: Corrigir Exclusão - Alterar Foreign Keys para SET NULL

## Diagnóstico

O problema está nas **Foreign Keys com regra `NO ACTION`** na tabela `order_item_sub_item_extras`:

| FK | Regra Atual | Problema |
|----|-------------|----------|
| `order_item_sub_item_extras.group_id` → `complement_groups.id` | **NO ACTION** | Bloqueia exclusão |
| `order_item_sub_item_extras.option_id` → `complement_options.id` | **NO ACTION** | Bloqueia exclusão |

Quando você tenta excluir um grupo ou opção, o PostgreSQL retorna o erro `23503` porque existem 5+ registros na tabela `order_item_sub_item_extras` que referenciam esses itens.

## Solução

Alterar as Foreign Keys para `SET NULL` para que:
1. Ao excluir um complement_group, o `group_id` nos registros históricos seja definido como `NULL`
2. Ao excluir um complement_option, o `option_id` nos registros históricos seja definido como `NULL`

Os registros históricos mantêm os campos `group_name` e `option_name` para preservar o histórico legível.

## Implementação

### Migração SQL

```sql
-- Alterar FK de group_id para SET NULL
ALTER TABLE public.order_item_sub_item_extras
  DROP CONSTRAINT IF EXISTS order_item_sub_item_extras_group_id_fkey;

ALTER TABLE public.order_item_sub_item_extras
  ADD CONSTRAINT order_item_sub_item_extras_group_id_fkey
    FOREIGN KEY (group_id)
    REFERENCES public.complement_groups(id)
    ON DELETE SET NULL;

-- Alterar FK de option_id para SET NULL
ALTER TABLE public.order_item_sub_item_extras
  DROP CONSTRAINT IF EXISTS order_item_sub_item_extras_option_id_fkey;

ALTER TABLE public.order_item_sub_item_extras
  ADD CONSTRAINT order_item_sub_item_extras_option_id_fkey
    FOREIGN KEY (option_id)
    REFERENCES public.complement_options(id)
    ON DELETE SET NULL;
```

## Resultado Esperado

Após a migração:

| Ação | Antes | Depois |
|------|-------|--------|
| Excluir complement_group vinculado | **ERRO 23503** | Sucesso (group_id vira NULL) |
| Excluir complement_option vinculado | **ERRO 23503** | Sucesso (option_id vira NULL) |
| Histórico de pedidos | - | Preservado (group_name, option_name mantidos) |

## Código (Já Implementado)

Os hooks já têm a lógica de soft delete como fallback, portanto não precisam de alteração:

```typescript
// useComplementGroups.ts - Lógica já existente
if (error.code === '23503') {
  await supabase.from('complement_groups').update({ is_active: false }).eq('id', id);
  return { softDeleted: true };
}
```

Após a migração, a exclusão real funcionará diretamente, e o soft delete só será usado em casos extremos.

## Arquivos

| Arquivo | Ação |
|---------|------|
| **Migração SQL** | Alterar FKs de NO ACTION para SET NULL |
| Hooks | Nenhuma alteração necessária |

