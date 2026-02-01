
# Plano: Correção do Problema de RLS - Owners sem Role 'admin'

## Diagnóstico Final

O problema foi identificado com precisão. O log mostra:

```
[deleteGroup] Result: {error: null, data: Array(0)}
```

**`data: Array(0)` significa que a RLS bloqueou silenciosamente a operação.**

### Causa Raiz

O grupo `f2902ad2-5bbe-4b54-95da-32ea813e8b6a` ("ESCOLHA 1 SABOR") pertence ao tenant `9f0ba9da-ccac-4835-80ed-e4e299c2109f` ("Unidade Aleixo").

O usuário `c1c176df-8579-4942-b310-9a6e124facd9` (DOM HELDER PIZZARIA):
- **É owner** do tenant "Unidade Aleixo" na tabela `tenant_members` (is_owner = true)
- **NÃO tem role 'admin'** na tabela `user_roles` para esse tenant

A política de RLS exige:
```sql
belongs_to_tenant(tenant_id) AND has_tenant_role(auth.uid(), tenant_id, 'admin')
```

Como não existe registro em `user_roles` para esse tenant, `has_tenant_role()` retorna `false` e o UPDATE é bloqueado.

## Solução

Modificar as políticas de RLS para aceitar **tanto owners quanto admins**. Isso é mais correto semanticamente, pois um owner deveria ter pelo menos as mesmas permissões de um admin.

### Alteração das Políticas

Substituir:
```sql
has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role)
```

Por:
```sql
(has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
```

### Tabelas Afetadas

| Tabela | Policy Atual | Nova Policy |
|--------|-------------|-------------|
| `complement_groups` | admin only | admin OR owner |
| `complement_options` | admin only | admin OR owner |
| `products` | admin only | admin OR owner |
| `categories` | admin only | admin OR owner |
| `product_extras` | admin only | admin OR owner |
| `product_variations` | admin only | admin OR owner |
| `ingredients` | admin only | admin OR owner |
| `kds_stations` | admin only | admin OR owner |
| `print_sectors` | admin only | admin OR owner |
| `kds_global_settings` | admin only | admin OR owner |

## Migração SQL

```sql
-- Atualizar política de complement_groups
DROP POLICY IF EXISTS "Tenant admins can manage complement groups" ON public.complement_groups;
CREATE POLICY "Tenant admins can manage complement groups" ON public.complement_groups
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- Atualizar política de complement_options
DROP POLICY IF EXISTS "Tenant admins can manage complement options" ON public.complement_options;
CREATE POLICY "Tenant admins can manage complement options" ON public.complement_options
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- Atualizar política de products
DROP POLICY IF EXISTS "Tenant admins can manage products" ON public.products;
CREATE POLICY "Tenant admins can manage products" ON public.products
  FOR ALL USING (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  )
  WITH CHECK (
    belongs_to_tenant(tenant_id) AND 
    (has_tenant_role(auth.uid(), tenant_id, 'admin'::app_role) OR is_tenant_owner(tenant_id))
  );

-- Mesma lógica para demais tabelas...
```

## Alternativa: Trigger para Auto-criar Role

Como medida complementar, podemos criar um trigger que automaticamente insere uma role 'admin' na `user_roles` quando um `tenant_member` é criado com `is_owner = true`.

```sql
CREATE OR REPLACE FUNCTION auto_create_admin_role_for_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_owner = TRUE THEN
    INSERT INTO user_roles (user_id, role, tenant_id)
    VALUES (NEW.user_id, 'admin', NEW.tenant_id)
    ON CONFLICT (user_id, role, tenant_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_admin_for_owner
AFTER INSERT ON tenant_members
FOR EACH ROW
EXECUTE FUNCTION auto_create_admin_role_for_owner();

-- Backfill: criar roles para owners existentes
INSERT INTO user_roles (user_id, role, tenant_id)
SELECT tm.user_id, 'admin', tm.tenant_id
FROM tenant_members tm
WHERE tm.is_owner = TRUE
ON CONFLICT DO NOTHING;
```

## Resultado Esperado

Após a migração:
- Owners poderão gerenciar todos os dados do seu tenant
- Admins (sem ser owner) continuarão funcionando normalmente
- Novos owners terão role 'admin' criada automaticamente

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| **Nova Migração SQL** | Atualizar políticas RLS + criar trigger + backfill |
| Nenhum código frontend | Não requer alterações |
