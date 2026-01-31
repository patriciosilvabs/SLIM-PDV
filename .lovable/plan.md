
# Plano: Sistema Multi-Lojas com Seletor de Tenant

## Contexto Atual

O sistema já possui arquitetura multi-tenant:
- Tabela `tenants` armazena as lojas
- Tabela `tenant_members` vincula usuários às lojas
- Mais de 40 hooks usam `tenantId` do `useTenant()`

**Problema**: O hook `useTenant()` usa `.maybeSingle()`, retornando apenas a primeira loja encontrada. Não há mecanismo para:
1. Listar todas as lojas do usuário
2. Alternar entre lojas
3. Persistir a loja selecionada

---

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────┐
│                      TenantProvider                         │
│  (Contexto React que gerencia tenant ativo + lista)         │
├─────────────────────────────────────────────────────────────┤
│  • allTenants: TenantMembership[]                           │
│  • activeTenant: TenantMembership | null                    │
│  • setActiveTenant(tenantId): void                          │
│  • tenantId: string (atalho para activeTenant.tenant_id)    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    TenantSwitcher                           │
│  (Componente dropdown no sidebar e header mobile)           │
├─────────────────────────────────────────────────────────────┤
│  • Mostra nome da loja atual                                │
│  • Lista todas as lojas do usuário                          │
│  • Permite criar nova loja (se owner)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## O Que Será Criado

### 1. Contexto: `TenantContext`

Novo contexto React que substitui o hook `useTenant()` para gerenciar múltiplas lojas.

Funcionalidades:
- Carrega todas as lojas do usuário (não apenas uma)
- Armazena tenant ativo no `localStorage`
- Fornece método `setActiveTenant()` para trocar de loja
- Valida se tenant persiste após login
- Invalida cache de queries ao trocar de loja

### 2. Componente: `TenantSwitcher`

Dropdown para alternar entre lojas.

Localização:
- Desktop: no topo do sidebar, abaixo do logo
- Mobile: no header, junto aos indicadores

Funcionalidades:
- Mostra nome da loja atual com ícone de loja
- Lista todas as lojas com indicador de qual está ativa
- Opção "Adicionar Loja" para owners (redireciona para onboarding adaptado)
- Badge com quantidade de lojas

### 3. Página: `CreateStore` (adaptação do Onboarding)

Permite criar lojas adicionais sem sair do sistema.

Diferenças do Onboarding:
- Não redireciona para /auth se não tem tenant
- Volta para o dashboard após criar
- Mostra navegação para voltar

### 4. Atualização do `useTenant` Hook

O hook atual será modificado para usar o contexto:

```typescript
// Antes
const { tenantId } = useTenant(); // Buscava do banco

// Depois  
const { tenantId } = useTenant(); // Retorna do contexto (mesma interface)
```

Isso garante que os 40+ arquivos que usam o hook continuem funcionando sem modificação.

---

## Limite de Lojas por Plano

Adicionar controle na tabela `subscription_plans`:

| Plano | max_tenants |
|-------|-------------|
| Starter | 3 |
| Professional | 20 |
| Enterprise | 100 |

A verificação será feita ao criar nova loja.

---

## Fluxo de Troca de Loja

```text
1. Usuário clica no TenantSwitcher
2. Seleciona outra loja
3. Sistema executa:
   a. setActiveTenant(newTenantId)
   b. localStorage.setItem('activeTenantId', newTenantId)
   c. queryClient.invalidateQueries() // Limpa todos os caches
   d. Página recarrega dados automaticamente
4. UI atualiza com dados da nova loja
```

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/contexts/TenantContext.tsx` | Contexto principal de multi-tenant |
| `src/components/TenantSwitcher.tsx` | Dropdown seletor de lojas |
| `src/pages/CreateStore.tsx` | Página para criar loja adicional |

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useTenant.ts` | Usar contexto em vez de query direta |
| `src/components/layout/PDVLayout.tsx` | Adicionar TenantSwitcher no sidebar |
| `src/App.tsx` | Envolver com TenantProvider |
| `src/pages/Onboarding.tsx` | Adaptar para permitir lojas adicionais |

---

## Considerações de Segurança

1. **Validação de Acesso**: Ao selecionar tenant, verificar se usuário realmente pertence a ele
2. **Tenant Inválido**: Se tenant salvo no localStorage não existir mais, limpar e redirecionar
3. **RLS**: Políticas existentes já filtram por `tenant_id`, continuam funcionando
4. **Refresh de Sessão**: Ao fazer login, verificar se tenant persistido ainda é válido

---

## Migração de Banco

Adicionar coluna `max_tenants` na tabela `subscription_plans` para controlar limite por plano.

---

## Ordem de Execução

1. Criar `TenantContext.tsx` com lógica de multi-tenant
2. Atualizar `useTenant.ts` para usar o contexto
3. Criar `TenantSwitcher.tsx` 
4. Adicionar TenantSwitcher ao `PDVLayout.tsx`
5. Envolver App com `TenantProvider`
6. Criar página `CreateStore.tsx`
7. Adicionar migração para `max_tenants`
8. Atualizar `Onboarding.tsx` para suportar criação adicional
