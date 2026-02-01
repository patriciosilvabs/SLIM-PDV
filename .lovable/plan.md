
# Plano: Correção Definitiva da Exclusão de Produtos, Complementos e Opções

## Diagnóstico Atual

Após investigação detalhada, identifiquei que:

1. **FKs no banco estão corretas** - As Foreign Keys nas tabelas `order_item_sub_item_extras` já foram alteradas para `ON DELETE SET NULL`
2. **RLS policies estão corretas** - As policies são PERMISSIVAS e permitem operações para admins
3. **Código dos hooks está correto** - A lógica de fallback para soft delete existe

O problema provavelmente está em:
- **Erro de RLS sendo interpretado incorretamente** - O PostgreSQL retorna erro de RLS como código diferente de `23503`
- **Outras FKs ainda bloqueando** - Pode haver FKs em outras tabelas que não foram identificadas

## Problemas Identificados

### 1. Código de Erro Incorreto
O erro de RLS (quando policy bloqueia) retorna código `42501` (insufficient_privilege), não `23503` (foreign_key_violation).

### 2. FKs em Cascata com RLS
Quando uma tabela filha tem RLS habilitado com policy restritiva, o CASCADE pode falhar se a operação de DELETE na tabela filha for bloqueada pela RLS.

## Solução

### Estratégia 1: Melhorar Tratamento de Erros nos Hooks

Atualizar os hooks para tratar múltiplos códigos de erro:

```typescript
const deleteProduct = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) {
      // Códigos de erro que indicam que devemos fazer soft delete:
      // 23503 = foreign_key_violation
      // 42501 = insufficient_privilege (RLS)
      // PGRST116 = "Results contain 0 rows" (RLS bloqueou silenciosamente)
      if (error.code === '23503' || error.code === '42501' || error.code === 'PGRST116') {
        const { error: softDeleteError } = await supabase
          .from('products')
          .update({ is_available: false })
          .eq('id', id);
        
        if (softDeleteError) throw softDeleteError;
        return { softDeleted: true };
      }
      throw error;
    }
    return { softDeleted: false };
  },
  // ...
});
```

### Estratégia 2: Alterar FKs em Cascata para Tabelas com RLS Restritivo

Modificar as FKs das tabelas intermediárias que têm CASCADE para SET NULL ou adicionar triggers que executam com SECURITY DEFINER:

```sql
-- Alterar complement_group_options para SET NULL em vez de CASCADE
ALTER TABLE public.complement_group_options
  DROP CONSTRAINT IF EXISTS complement_group_options_option_id_fkey;

ALTER TABLE public.complement_group_options
  ADD CONSTRAINT complement_group_options_option_id_fkey
    FOREIGN KEY (option_id)
    REFERENCES public.complement_options(id)
    ON DELETE SET NULL;

-- Mesmo para group_id
ALTER TABLE public.complement_group_options
  DROP CONSTRAINT IF EXISTS complement_group_options_group_id_fkey;

ALTER TABLE public.complement_group_options
  ADD CONSTRAINT complement_group_options_group_id_fkey
    FOREIGN KEY (group_id)
    REFERENCES public.complement_groups(id)
    ON DELETE SET NULL;
```

### Estratégia 3: Usar Soft Delete Direto (Mais Seguro)

Alterar a estratégia para sempre fazer soft delete primeiro, evitando problemas de FK:

```typescript
const deleteProduct = useMutation({
  mutationFn: async (id: string) => {
    // Sempre fazer soft delete primeiro
    const { error } = await supabase
      .from('products')
      .update({ is_available: false })
      .eq('id', id);
    
    if (error) throw error;
    return { softDeleted: true };
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    toast({ title: 'Produto desativado com sucesso!' });
  },
  // ...
});
```

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useProducts.ts` | Usar soft delete direto ou melhorar tratamento de erro |
| `src/hooks/useComplementGroups.ts` | Usar soft delete direto ou melhorar tratamento de erro |
| `src/hooks/useComplementOptions.ts` | Usar soft delete direto ou melhorar tratamento de erro |
| `src/hooks/useProductExtras.ts` | Usar soft delete direto ou melhorar tratamento de erro |
| `src/hooks/useProductVariations.ts` | Usar soft delete direto ou melhorar tratamento de erro |
| `src/hooks/useCategories.ts` | Adicionar soft delete (não tem atualmente) |
| Migração SQL | Alterar FKs de CASCADE para SET NULL nas tabelas intermediárias |

## Migração SQL Proposta

```sql
-- Alterar FKs de complement_group_options para SET NULL
ALTER TABLE public.complement_group_options
  DROP CONSTRAINT IF EXISTS complement_group_options_group_id_fkey,
  ADD CONSTRAINT complement_group_options_group_id_fkey 
    FOREIGN KEY (group_id) REFERENCES public.complement_groups(id) ON DELETE SET NULL;

ALTER TABLE public.complement_group_options
  DROP CONSTRAINT IF EXISTS complement_group_options_option_id_fkey,
  ADD CONSTRAINT complement_group_options_option_id_fkey 
    FOREIGN KEY (option_id) REFERENCES public.complement_options(id) ON DELETE SET NULL;

-- Alterar FKs de product_complement_groups para SET NULL
ALTER TABLE public.product_complement_groups
  DROP CONSTRAINT IF EXISTS product_complement_groups_group_id_fkey,
  ADD CONSTRAINT product_complement_groups_group_id_fkey 
    FOREIGN KEY (group_id) REFERENCES public.complement_groups(id) ON DELETE SET NULL;

ALTER TABLE public.product_complement_groups
  DROP CONSTRAINT IF EXISTS product_complement_groups_product_id_fkey,
  ADD CONSTRAINT product_complement_groups_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

-- Alterar FKs de complement_option_ingredients para SET NULL
ALTER TABLE public.complement_option_ingredients
  DROP CONSTRAINT IF EXISTS complement_option_ingredients_complement_option_id_fkey,
  ADD CONSTRAINT complement_option_ingredients_complement_option_id_fkey 
    FOREIGN KEY (complement_option_id) REFERENCES public.complement_options(id) ON DELETE SET NULL;

-- Alterar FKs de product_ingredients para SET NULL
ALTER TABLE public.product_ingredients
  DROP CONSTRAINT IF EXISTS product_ingredients_product_id_fkey,
  ADD CONSTRAINT product_ingredients_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
```

## Recomendação Final

Implementar **ambas** as estratégias:

1. **Migração SQL** para alterar FKs de CASCADE para SET NULL nas tabelas intermediárias
2. **Atualizar hooks** para usar soft delete direto, que é mais confiável e evita todos os problemas de FK

A abordagem de soft delete direto é mais robusta porque:
- Não depende de cascatas funcionarem corretamente
- Preserva todos os dados históricos
- Permite recuperação fácil se necessário
- Evita problemas de RLS em cascata
