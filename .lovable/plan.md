
# Plano: Sistema Multi-Loja com Grupos e Replicação de Cardápio

## Visão Geral

Implementar funcionalidades para que um proprietário possa:
1. Criar múltiplas lojas dentro de um "grupo"
2. Cada loja ter seu link de pedidos independente (via slug)
3. Replicar/sincronizar cardápio entre lojas do mesmo grupo

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────┐
│                     OWNER (Proprietário)                    │
│                    owner_id = user.id                       │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Possui múltiplos
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    TENANT GROUP (Grupo)                     │
│    - Agrupa lojas do mesmo dono                             │
│    - Todas lojas com mesmo owner_id = mesmo grupo           │
└───────────────────────────┬─────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │  Loja 1  │      │  Loja 2  │      │  Loja 3  │
    │  /loja1  │      │  /loja2  │      │  /loja3  │
    └──────────┘      └──────────┘      └──────────┘
          │                 │
          │  REPLICAR ──────┘
          ▼
    Categorias, Produtos, Grupos de Complemento, Opções
```

---

## Fase 1: Conceito de Grupo de Lojas

### Abordagem Simplificada (sem nova tabela)

Todas as lojas do mesmo `owner_id` formam automaticamente um "grupo". Isso evita complexidade adicional e aproveita a estrutura existente.

A identificação do grupo será:
- **Grupo** = Todas as `tenants` onde `owner_id = user_id_do_proprietario`

### Consulta para buscar lojas do grupo

```sql
SELECT * FROM tenants 
WHERE owner_id = (SELECT owner_id FROM tenants WHERE id = :current_tenant_id)
```

---

## Fase 2: Interface de Gerenciamento de Lojas do Grupo

### 2.1 Nova Seção em Configurações: "Minhas Lojas"

| Arquivo | Ação |
|---------|------|
| `src/components/settings/SettingsSidebar.tsx` | Adicionar seção "Lojas" com ícone `Building2` |
| `src/components/settings/StoresSettings.tsx` | Novo componente para gerenciar lojas do grupo |
| `src/pages/Settings.tsx` | Registrar nova seção |

### 2.2 Componente StoresSettings

Funcionalidades:
- Listar todas as lojas do grupo (mesmo owner_id)
- Botão para criar nova loja (redireciona para `/create-store`)
- Ver link do cardápio de cada loja (`slim.app/{slug}`)
- Acessar configurações de cada loja

### 2.3 Hook useGroupStores

```typescript
// src/hooks/useGroupStores.ts
export function useGroupStores() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['group-stores', tenantId],
    queryFn: async () => {
      // 1. Buscar owner_id do tenant atual
      const { data: currentTenant } = await supabase
        .from('tenants')
        .select('owner_id')
        .eq('id', tenantId)
        .single();
      
      if (!currentTenant?.owner_id) return [];
      
      // 2. Buscar todas lojas do mesmo owner
      const { data } = await supabase
        .from('tenants')
        .select('id, name, slug, is_active, created_at')
        .eq('owner_id', currentTenant.owner_id)
        .order('created_at');
      
      return data || [];
    },
    enabled: !!tenantId,
  });
}
```

---

## Fase 3: Replicação de Cardápio

### 3.1 Dados que serão replicados

| Tabela | Campos a copiar |
|--------|-----------------|
| `categories` | name, description, icon, sort_order, is_active |
| `products` | Todos os campos exceto id, tenant_id, created_at, updated_at |
| `product_variations` | name, description, price_modifier, is_active |
| `complement_groups` | Todos os campos de configuração |
| `complement_options` | name, price, cost_price, etc |
| `complement_group_options` | Associações entre grupos e opções |
| `product_complement_groups` | Associações entre produtos e grupos |

### 3.2 Interface de Replicação

Nova tela/modal: **"Replicar Cardápio"**

```
┌─────────────────────────────────────────────────────────────┐
│            REPLICAR CARDÁPIO PARA OUTRAS LOJAS              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Origem: DOM HELDER PIZZARIA (loja atual)                   │
│                                                             │
│  Selecione o que replicar:                                  │
│  [x] Categorias                                             │
│  [x] Produtos (inclui variações)                            │
│  [x] Grupos de Complemento                                  │
│  [x] Opções de Complemento                                  │
│                                                             │
│  Destino:                                                   │
│  [ ] DOM HELDER PIZZARIA - ALEIXO                           │
│  [ ] DOM HELDER - SHOPPING                                  │
│                                                             │
│  ⚠️ Atenção: Itens existentes com mesmo nome serão          │
│     atualizados. Novos itens serão criados.                 │
│                                                             │
│             [ Cancelar ]    [ Replicar Cardápio ]           │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Edge Function para Replicação

```typescript
// supabase/functions/replicate-menu/index.ts
// POST /replicate-menu
// Body: { 
//   source_tenant_id: string,
//   target_tenant_ids: string[],
//   options: { 
//     categories: boolean,
//     products: boolean, 
//     variations: boolean,
//     complement_groups: boolean,
//     complement_options: boolean 
//   }
// }
```

**Lógica de replicação:**

1. Validar que usuário é owner de ambos tenants
2. Para cada tabela selecionada:
   - Buscar dados do tenant origem
   - Para cada item:
     - Se existir item com mesmo `name` no destino → UPDATE
     - Se não existir → INSERT com novo id e tenant_id destino
3. Manter mapeamento de IDs antigos → novos para relacionamentos
4. Replicar associações (product_complement_groups, etc)

### 3.4 Hook useMenuReplication

```typescript
// src/hooks/useMenuReplication.ts
export function useMenuReplication() {
  const replicateMenu = useMutation({
    mutationFn: async (params: ReplicateMenuParams) => {
      const { data, error } = await supabase.functions.invoke('replicate-menu', {
        body: params
      });
      if (error) throw error;
      return data;
    }
  });
  
  return { replicateMenu };
}
```

---

## Fase 4: Melhorias no TenantSwitcher

### Mostrar lojas agrupadas

Atualizar `TenantSwitcher` para mostrar:
- Lojas onde o usuário é **dono** (pode criar mais)
- Lojas onde o usuário é apenas **membro** (não pode criar)

```text
┌──────────────────────────┐
│    SUAS LOJAS            │
│                          │
│ 🏠 DOM HELDER PIZZARIA   │  ← Dono
│    • Link: /dom-helder   │
│                          │
│ 🏠 DOM HELDER - ALEIXO   │  ← Dono  
│    • Link: /dom-aleixo   │
│                          │
│ ─────────────────────────│
│    LOJAS QUE TRABALHA    │
│                          │
│ 👤 Meu Restaurante       │  ← Membro
│                          │
│ ─────────────────────────│
│ ➕ Adicionar loja        │
└──────────────────────────┘
```

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useGroupStores.ts` | Hook para buscar lojas do mesmo grupo/owner |
| `src/hooks/useMenuReplication.ts` | Hook para chamar edge function de replicação |
| `src/components/settings/StoresSettings.tsx` | Componente de gerenciamento de lojas |
| `src/components/menu/ReplicateMenuDialog.tsx` | Modal de replicação de cardápio |
| `supabase/functions/replicate-menu/index.ts` | Edge function para replicação |

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/settings/SettingsSidebar.tsx` | Adicionar seção "Lojas" |
| `src/pages/Settings.tsx` | Registrar nova seção e componente |
| `src/components/TenantSwitcher.tsx` | Melhorar visualização de lojas |
| `src/pages/Menu.tsx` | Adicionar botão "Replicar para outras lojas" |
| `supabase/config.toml` | Registrar nova edge function |

---

## Ordem de Implementação

1. **Criar hook `useGroupStores`** - Buscar todas lojas do owner
2. **Criar `StoresSettings`** - Interface de listagem de lojas
3. **Atualizar `SettingsSidebar`** - Nova seção
4. **Atualizar `TenantSwitcher`** - Separar lojas próprias vs lojas que trabalha
5. **Criar Edge Function `replicate-menu`** - Backend de replicação
6. **Criar `ReplicateMenuDialog`** - Interface de replicação
7. **Adicionar botão na tela de Menu** - Disparar replicação

---

## Considerações de Segurança

- Edge function valida que usuário é `owner_id` de AMBOS os tenants (origem e destino)
- Apenas donos podem replicar cardápio
- Replicação é one-way (origem → destino), não sincronização bidirecional
- Logs de replicação para auditoria

---

## Link do Site de Pedidos

Cada loja já tem um `slug` único que pode ser usado como:
- `https://cardapio.seudominio.com/{slug}`
- `https://slim.app/{slug}`

O slug já está sendo configurado na criação da loja (`CreateStore.tsx`).

