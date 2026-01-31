

# Plano: Resolver Problema de Usuários de Outros Tenants Aparecendo

## Problema Diagnosticado

Após análise detalhada do banco de dados e código:

| Usuário | Status no Banco | Tenant Associado |
|---------|-----------------|------------------|
| DOM HELDER PIZZARIA | ✅ Correto | DOM HELDER PIZZARIA |
| HELDER MOITA FREIRE | ✅ Correto | DOM HELDER PIZZARIA - ALEIXO |
| PATRICIO | ✅ Correto | Meu Restaurante |
| JULIETE CAIXA | ⚠️ Sem tenant_members | Nenhum |
| KDS-ALEIXO | ⚠️ Errado | Meu Restaurante (em user_roles) mas sem tenant_members |

### Causa Raiz

1. **Código correto mas não publicado** - As alterações no hook `useAllUsers()` foram feitas no preview, mas o usuário está acessando a **versão publicada** que ainda tem o código antigo

2. **Dados legados** - Alguns usuários foram criados antes da implementação do sistema multi-tenant e não têm registro na tabela `tenant_members`

---

## Solução em Duas Etapas

### Etapa 1: Publicar a Aplicação

Você precisa **publicar** o projeto para que as correções de código sejam aplicadas na versão de produção.

O código já está correto no preview:
- Hook `useAllUsers()` → Filtra por `tenant_members`
- Hook `useEmployees()` → Filtra por `tenant_members`

### Etapa 2: Limpar Dados Legados do Banco

Usuários antigos que não pertencem a nenhum tenant precisam ser removidos ou corrigidos.

**Opção A - Remover usuários órfãos:**
Executar SQL para excluir usuários sem associação a tenant:

```sql
-- Ver usuários órfãos
SELECT p.id, p.name
FROM profiles p
LEFT JOIN tenant_members tm ON tm.user_id = p.id
WHERE tm.user_id IS NULL;

-- Remover roles de usuários órfãos
DELETE FROM user_roles
WHERE user_id NOT IN (SELECT user_id FROM tenant_members);

-- Os profiles podem ficar, pois podem ter referências em históricos
```

**Opção B - Associar usuários órfãos ao tenant correto:**
Se JULIETE CAIXA deveria pertencer a "DOM HELDER PIZZARIA":

```sql
INSERT INTO tenant_members (user_id, tenant_id, is_owner, joined_at)
VALUES (
  '19107f85-df7d-4408-80f1-f871cb7ad699',  -- JULIETE CAIXA
  '9760d4e5-4a73-4668-97bb-280170ff3431',  -- DOM HELDER PIZZARIA
  false,
  now()
);

-- Atualizar role para ter tenant_id
UPDATE user_roles
SET tenant_id = '9760d4e5-4a73-4668-97bb-280170ff3431'
WHERE user_id = '19107f85-df7d-4408-80f1-f871cb7ad699';
```

---

## Ações Necessárias

| # | Ação | Responsável |
|---|------|-------------|
| 1 | Publicar o projeto (botão "Publish" no Lovable) | Você |
| 2 | Executar migração SQL para limpar dados | Sistema (eu farei) |

---

## SQL de Limpeza Proposto

Executarei uma migração que:

1. Remove roles de usuários sem tenant_members
2. NÃO deleta os profiles (mantém histórico de ações)

```sql
-- Remover roles órfãs (usuários sem tenant)
DELETE FROM user_roles
WHERE user_id NOT IN (
  SELECT user_id FROM tenant_members
);

-- Remover permissões órfãs
DELETE FROM user_permissions  
WHERE user_id NOT IN (
  SELECT user_id FROM tenant_members
);
```

---

## Resultado Esperado

Após publicar e executar a limpeza:
- Cada cliente verá **APENAS** usuários do seu restaurante
- Usuários legados serão removidos da listagem
- O sistema estará seguro contra vazamento de dados entre tenants

