
# Plano: Corrigir Vazamento de Dados de Usuários Entre Tenants

## Problema Identificado

**Falha CRÍTICA de segurança**: Um cliente novo consegue ver usuários de OUTROS restaurantes na tela "Usuários do Sistema".

### Causa Raiz

1. **Política RLS da tabela `profiles`**: Está configurada com `qual:true` (qualquer autenticado vê todos)
2. **Hook `useAllUsers()`**: Busca TODOS os profiles sem filtrar por tenant
3. **Hook `useEmployees()`**: Mesmo problema

### Dados Atuais no Banco

| Tenant | Usuário |
|--------|---------|
| DOM HELDER PIZZARIA | DOM HELDER PIZZARIA |
| DOM HELDER PIZZARIA - ALEIXO | HELDER MOITA FREIRE |
| Meu Restaurante | PATRICIO |

Todos esses usuários estão aparecendo juntos para qualquer cliente!

---

## Solução

### 1. Corrigir Hook `useAllUsers()` 

Modificar para buscar apenas usuários que são membros do tenant atual:

```typescript
export function useAllUsers() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['all-users', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      // Buscar apenas membros do tenant atual
      const { data: members, error: membersError } = await supabase
        .from('tenant_members')
        .select('user_id')
        .eq('tenant_id', tenantId);
      
      if (membersError) throw membersError;
      if (!members?.length) return [];
      
      const userIds = members.map(m => m.user_id);
      
      // Buscar profiles apenas dos membros
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);
      
      if (profilesError) throw profilesError;
      
      // Buscar roles filtrados por tenant
      const { data: allRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('tenant_id', tenantId);
      
      if (rolesError) throw rolesError;
      
      // Combinar dados
      return profiles.map((profile) => ({
        ...profile,
        user_roles: (allRoles || [])
          .filter((role) => role.user_id === profile.id)
          .map((r) => ({ role: r.role as AppRole })),
      }));
    },
    enabled: !!tenantId,
  });
}
```

### 2. Corrigir Hook `useEmployees()`

Mesmo padrão - filtrar por tenant:

```typescript
export function useEmployees() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['employees', tenantId],
    queryFn: async (): Promise<Employee[]> => {
      if (!tenantId) return [];
      
      // Buscar membros do tenant
      const { data: members, error: membersError } = await supabase
        .from('tenant_members')
        .select('user_id')
        .eq('tenant_id', tenantId);
      
      if (membersError) throw membersError;
      if (!members?.length) return [];
      
      const userIds = members.map(m => m.user_id);
      
      // Buscar profiles apenas dos membros
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });
}
```

### 3. (Opcional) Reforçar RLS na tabela `profiles`

Criar uma VIEW que mostra apenas profiles do mesmo tenant, ou manter a política atual já que a filtragem será feita no código. A política RLS atual é necessária porque alguns casos precisam ver nomes de usuários (ex: "cancelado por X").

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useUserRole.ts` | Adicionar import do `useTenant` e filtrar `useAllUsers()` por `tenant_id` |
| `src/hooks/useEmployees.ts` | Adicionar import do `useTenant` e filtrar por `tenant_id` |

---

## Impacto

Após a correção:
- Cada cliente verá APENAS os usuários do seu próprio restaurante
- Usuários novos terão a lista vazia até adicionar funcionários
- A troca de tenant (multi-store) continuará funcionando - a lista será atualizada automaticamente

---

## Seção Técnica

### Por que não só ajustar RLS?

A política RLS da tabela `profiles` com `qual:true` é intencional para permitir que:
- Usuários vejam nomes em históricos de cancelamento
- Usuários vejam quem fez determinadas ações

A filtragem por tenant deve ser feita nas consultas específicas (hooks) porque `profiles` não tem `tenant_id` direto - precisa consultar via `tenant_members`.

### Query Key

Incluir `tenantId` na query key garante que:
- Cache é invalidado ao trocar de loja
- Dados corretos são carregados para cada tenant
