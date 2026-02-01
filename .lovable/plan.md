

# Plano: Correção Definitiva - Colunas NOT NULL Impedem SET NULL

## Diagnóstico Final

O erro **persiste** porque as migrações anteriores definiram `ON DELETE SET NULL` nas Foreign Keys, mas as **colunas continuam NOT NULL**. Quando o PostgreSQL tenta executar o SET NULL, ele falha com o erro:

```
null value in column "group_id" of relation "complement_group_options" violates not-null constraint
```

### Status Atual das Colunas

| Tabela | Coluna | É Nullable? | Problema |
|--------|--------|-------------|----------|
| `complement_group_options` | `group_id` | **NO** | SET NULL falha |
| `complement_group_options` | `option_id` | **NO** | SET NULL falha |
| `product_complement_groups` | `product_id` | **NO** | SET NULL falha |
| `product_complement_groups` | `group_id` | **NO** | SET NULL falha |
| `product_ingredients` | `product_id` | **NO** | SET NULL falha |
| `complement_option_ingredients` | `complement_option_id` | **NO** | SET NULL falha |

## Solução

**Opção escolhida: Alterar FK para ON DELETE CASCADE + Usar Soft Delete Direto**

A melhor abordagem para tabelas intermediárias (junction tables) é usar `ON DELETE CASCADE`:
- Quando o grupo ou opção é excluído, os registros de vínculo são automaticamente removidos
- Isso é o comportamento correto para tabelas de relacionamento N:N
- Não afeta dados históricos (que estão em `order_item_sub_item_extras` com colunas nullable)

### Migração SQL

```sql
-- 1. Alterar complement_group_options para CASCADE
ALTER TABLE public.complement_group_options
  DROP CONSTRAINT IF EXISTS complement_group_options_group_id_fkey;
ALTER TABLE public.complement_group_options
  ADD CONSTRAINT complement_group_options_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES public.complement_groups(id) ON DELETE CASCADE;

ALTER TABLE public.complement_group_options
  DROP CONSTRAINT IF EXISTS complement_group_options_option_id_fkey;
ALTER TABLE public.complement_group_options
  ADD CONSTRAINT complement_group_options_option_id_fkey
    FOREIGN KEY (option_id) REFERENCES public.complement_options(id) ON DELETE CASCADE;

-- 2. Alterar product_complement_groups para CASCADE
ALTER TABLE public.product_complement_groups
  DROP CONSTRAINT IF EXISTS product_complement_groups_group_id_fkey;
ALTER TABLE public.product_complement_groups
  ADD CONSTRAINT product_complement_groups_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES public.complement_groups(id) ON DELETE CASCADE;

ALTER TABLE public.product_complement_groups
  DROP CONSTRAINT IF EXISTS product_complement_groups_product_id_fkey;
ALTER TABLE public.product_complement_groups
  ADD CONSTRAINT product_complement_groups_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- 3. Alterar complement_option_ingredients para CASCADE
ALTER TABLE public.complement_option_ingredients
  DROP CONSTRAINT IF EXISTS complement_option_ingredients_complement_option_id_fkey;
ALTER TABLE public.complement_option_ingredients
  ADD CONSTRAINT complement_option_ingredients_complement_option_id_fkey
    FOREIGN KEY (complement_option_id) REFERENCES public.complement_options(id) ON DELETE CASCADE;

-- 4. Alterar product_ingredients para CASCADE
ALTER TABLE public.product_ingredients
  DROP CONSTRAINT IF EXISTS product_ingredients_product_id_fkey;
ALTER TABLE public.product_ingredients
  ADD CONSTRAINT product_ingredients_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- 5. Alterar product_extra_links para CASCADE (se existir)
ALTER TABLE public.product_extra_links
  DROP CONSTRAINT IF EXISTS product_extra_links_product_id_fkey;
ALTER TABLE public.product_extra_links
  ADD CONSTRAINT product_extra_links_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.product_extra_links
  DROP CONSTRAINT IF EXISTS product_extra_links_extra_id_fkey;
ALTER TABLE public.product_extra_links
  ADD CONSTRAINT product_extra_links_extra_id_fkey
    FOREIGN KEY (extra_id) REFERENCES public.product_extras(id) ON DELETE CASCADE;
```

### Alteração nos Hooks

Como o soft delete já está implementado, os hooks não precisam de alteração. A estratégia já é:
1. Executar `update({ is_available: false })` ou `update({ is_active: false })`
2. Isso não aciona CASCADE (é um UPDATE, não DELETE)
3. O item fica oculto mas mantém todos os vínculos

No entanto, caso o administrador queira realmente excluir (não apenas desativar), o CASCADE funcionará corretamente.

## Resultado Esperado

| Ação | Comportamento |
|------|---------------|
| Clicar "Excluir" produto | Executa soft delete (`is_available: false`) - produto fica oculto |
| Clicar "Excluir" grupo | Executa soft delete (`is_active: false`) - grupo fica inativo |
| Clicar "Excluir" opção | Executa soft delete (`is_active: false`) - opção fica inativa |
| Exclusão real (se implementada) | CASCADE remove vínculos automaticamente |

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| **Nova Migração SQL** | Alterar todas as FKs para CASCADE |
| Nenhum hook | Já estão com soft delete |

