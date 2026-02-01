
# Plano: Exclusao Permanente de Produtos, Complementos e Opcoes

## Resumo

Alterar o comportamento de exclusao de **soft delete** (inativacao) para **hard delete** (remocao completa) para produtos, grupos de complementos e opcoes de complemento.

## Analise de Dependencias

A analise do banco de dados revela as seguintes restricoes de chave estrangeira:

| Tabela Pai | Tabela Filha | Regra Atual |
|------------|--------------|-------------|
| `products` | `order_items` | NO ACTION (bloqueia) |
| `products` | `product_variations` | CASCADE |
| `products` | `product_ingredients` | CASCADE |
| `products` | `product_extra_links` | CASCADE |
| `products` | `product_complement_groups` | CASCADE |
| `products` | `combo_items` | CASCADE |
| `products` | `cardapioweb_product_mappings` | NO ACTION (bloqueia) |
| `complement_groups` | `complement_group_options` | CASCADE |
| `complement_groups` | `product_complement_groups` | CASCADE |
| `complement_groups` | `order_item_sub_item_extras` | NO ACTION (bloqueia) |
| `complement_options` | `complement_group_options` | CASCADE |
| `complement_options` | `complement_option_ingredients` | CASCADE |
| `complement_options` | `order_item_sub_item_extras` | NO ACTION (bloqueia) |

### Problema Identificado

As tabelas de historico (`order_items`, `order_item_sub_item_extras`, `cardapioweb_product_mappings`) usam **NO ACTION**, o que impediria a exclusao de itens ja vendidos.

### Solucao

Alterar essas FKs para **SET NULL** - assim os pedidos historicos continuam existindo mas sem referencia ao item excluido. Os pedidos ja armazenam `product_name`, `option_name` e `group_name` como texto, entao o historico nao sera afetado.

## Alteracoes

### 1. Migracao SQL

Atualizar as foreign keys para permitir exclusao:

```text
+--------------------------------------------------+
|     order_items.product_id -> SET NULL           |
|     order_item_sub_item_extras.option_id -> SET NULL |
|     order_item_sub_item_extras.group_id -> SET NULL  |
|     cardapioweb_product_mappings.local_product_id -> SET NULL |
+--------------------------------------------------+
```

### 2. Alteracoes nos Hooks

| Arquivo | Alteracao |
|---------|-----------|
| `useProducts.ts` | Trocar `.update({ is_available: false })` por `.delete()` |
| `useComplementGroups.ts` | Trocar `.update({ is_active: false })` por `.delete()` |
| `useComplementOptions.ts` | Trocar `.update({ is_active: false })` por `.delete()` |
| `useProductExtras.ts` | Trocar `.update({ is_active: false })` por `.delete()` |
| `useProductVariations.ts` | Trocar `.update({ is_active: false })` por `.delete()` |

### 3. Exemplo de Alteracao (useProducts.ts)

**Antes:**
```typescript
const deleteProduct = useMutation({
  mutationFn: async (id: string) => {
    const { error, data } = await supabase
      .from('products')
      .update({ is_available: false })
      .eq('id', id)
      .select();
    if (error) throw error;
    return { softDeleted: true };
  },
  onSuccess: () => {
    toast({ title: 'Produto desativado com sucesso!' });
  }
});
```

**Depois:**
```typescript
const deleteProduct = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
  onSuccess: () => {
    toast({ title: 'Produto excluído com sucesso!' });
  }
});
```

## Detalhes Tecnicos

### SQL da Migracao

```sql
-- Alterar FK order_items.product_id para SET NULL
ALTER TABLE order_items 
  DROP CONSTRAINT IF EXISTS order_items_product_id_fkey,
  ADD CONSTRAINT order_items_product_id_fkey 
    FOREIGN KEY (product_id) 
    REFERENCES products(id) 
    ON DELETE SET NULL;

-- Alterar FK order_item_sub_item_extras.option_id para SET NULL
ALTER TABLE order_item_sub_item_extras 
  DROP CONSTRAINT IF EXISTS order_item_sub_item_extras_option_id_fkey,
  ADD CONSTRAINT order_item_sub_item_extras_option_id_fkey 
    FOREIGN KEY (option_id) 
    REFERENCES complement_options(id) 
    ON DELETE SET NULL;

-- Alterar FK order_item_sub_item_extras.group_id para SET NULL
ALTER TABLE order_item_sub_item_extras 
  DROP CONSTRAINT IF EXISTS order_item_sub_item_extras_group_id_fkey,
  ADD CONSTRAINT order_item_sub_item_extras_group_id_fkey 
    FOREIGN KEY (group_id) 
    REFERENCES complement_groups(id) 
    ON DELETE SET NULL;

-- Alterar FK cardapioweb_product_mappings.local_product_id para SET NULL
ALTER TABLE cardapioweb_product_mappings 
  DROP CONSTRAINT IF EXISTS cardapioweb_product_mappings_local_product_id_fkey,
  ADD CONSTRAINT cardapioweb_product_mappings_local_product_id_fkey 
    FOREIGN KEY (local_product_id) 
    REFERENCES products(id) 
    ON DELETE SET NULL;
```

## Resultado Esperado

- Produtos, grupos e opcoes serao excluidos permanentemente do banco
- Pedidos historicos manterao seus dados (nomes gravados como texto)
- Referencias de FK serao anuladas (SET NULL) em vez de bloquear
- Tabelas relacionadas com CASCADE serao limpas automaticamente (variacoes, ingredientes, links)
