
# Plano: Corrigir Exclusão de Produtos, Complementos e Opções

## Diagnóstico

A exclusão está sendo bloqueada por **chaves estrangeiras restritivas (NO ACTION/RESTRICT)** que impedem a remoção quando existem registros relacionados.

### Tabelas Afetadas e Suas Dependências

| Tabela a Excluir | Tabela Dependente | Coluna | Regra Atual | Problema |
|------------------|-------------------|--------|-------------|----------|
| **products** | order_items | product_id | NO ACTION | Bloqueia se produto já foi vendido |
| **products** | cardapioweb_product_mappings | local_product_id | NO ACTION | Bloqueia se mapeado com CardapioWeb |
| **complement_options** | order_item_extras | extra_id | SET NULL | OK - apenas limpa referência |
| **complement_groups** | order_item_sub_item_extras | group_id | SET NULL | OK - apenas limpa referência |

## Solução

### Estratégia: Soft Delete para Produtos (Recomendado)

Como produtos já vendidos não podem ser deletados (integridade dos dados de vendas), implementar **soft delete** através do campo `is_available`:

1. Ao "excluir" um produto, marcar como `is_available = false` ao invés de remover
2. Filtrar produtos com `is_available = false` das listagens principais
3. Opcionalmente, adicionar um campo `deleted_at` para registro de exclusão

### Alternativa: Exclusão Real com Tratamento de Erros

Se o cliente preferir exclusão real, tratar o erro e informar o motivo ao usuário.

## Implementação

### 1. Atualizar Hook de Produtos

Modificar `useProducts.ts` para:
- Tentar exclusão real primeiro
- Se falhar por FK, perguntar ao usuário se deseja desativar
- Ou implementar soft delete direto

```typescript
// Opção A: Soft Delete
const deleteProduct = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from('products')
      .update({ is_available: false })  // Soft delete
      .eq('id', id);
    
    if (error) throw error;
  },
  ...
});

// Opção B: Tentar real, fallback para soft
const deleteProduct = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) {
      if (error.code === '23503') { // FK violation
        // Tentar soft delete
        await supabase.from('products').update({ is_available: false }).eq('id', id);
      } else {
        throw error;
      }
    }
  },
  ...
});
```

### 2. Atualizar Hook de Complementos

Modificar `useComplementGroups.ts` e `useComplementOptions.ts` com a mesma estratégia:
- Usar `is_active = false` como soft delete
- Tratar erro de FK com mensagem clara

### 3. Atualizar Mensagens de Erro

Melhorar feedback ao usuário quando exclusão falhar:

```typescript
onError: (error: Error) => {
  if (error.message.includes('violates foreign key constraint')) {
    toast({ 
      title: 'Não foi possível excluir', 
      description: 'Este item está vinculado a pedidos ou outras configurações. Deseja desativá-lo?',
      variant: 'destructive' 
    });
  } else {
    toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
  }
}
```

### 4. Atualizar FKs no Banco (Opcional)

Se preferir comportamento automático, alterar as constraints para `ON DELETE SET NULL`:

```sql
-- Para products -> order_items (permite excluir produto, itens ficam órfãos)
ALTER TABLE order_items 
  DROP CONSTRAINT order_items_product_id_fkey,
  ADD CONSTRAINT order_items_product_id_fkey 
    FOREIGN KEY (product_id) 
    REFERENCES products(id) 
    ON DELETE SET NULL;

-- Para products -> cardapioweb_product_mappings
ALTER TABLE cardapioweb_product_mappings 
  DROP CONSTRAINT cardapioweb_product_mappings_local_product_id_fkey,
  ADD CONSTRAINT cardapioweb_product_mappings_local_product_id_fkey 
    FOREIGN KEY (local_product_id) 
    REFERENCES products(id) 
    ON DELETE SET NULL;
```

**Nota:** Essa alteração no banco permite exclusão real, mas os dados históricos perdem referência ao produto original.

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useProducts.ts` | Implementar soft delete ou tratamento de erro FK |
| `src/hooks/useComplementGroups.ts` | Implementar soft delete ou tratamento de erro FK |
| `src/hooks/useComplementOptions.ts` | Implementar soft delete ou tratamento de erro FK |
| (Opcional) Migração SQL | Alterar constraints de FK para SET NULL |

## Recomendação

Recomendo a **Estratégia de Soft Delete** porque:

1. **Preserva integridade dos dados** - Pedidos antigos mantêm referência ao produto
2. **Relatórios precisos** - Histórico de vendas continua mostrando nomes corretos
3. **Recuperação fácil** - Pode reativar produto se necessário
4. **Sem alteração de schema** - Usa campos já existentes (`is_available`, `is_active`)

Para produtos/opções desativados, podemos adicionar um filtro "Mostrar inativos" na interface.
