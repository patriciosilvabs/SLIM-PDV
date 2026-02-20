
# Correcao: KDS sempre mostra Kanban mesmo com Linha de Producao configurada

## Problema identificado

O KDS mostra a visualizacao Kanban (PENDENTE, EM PREPARO, PRONTO) mesmo quando o modo "Linha de Producao" esta configurado no banco de dados.

**Causa raiz:** Quando o KDS e acessado via login de dispositivo (codigo verificador + codigo de autenticacao), nao existe uma sessao de usuario autenticada no banco. O hook `useKdsSettings` depende da funcao `get_user_tenant_id()` para buscar as configuracoes globais do tenant. Sem sessao de usuario, `tenantId` retorna `null`, a query e desabilitada, e o sistema usa configuracoes padrao que definem `operationMode: 'traditional'` (Kanban).

Resultado: **nenhum dispositivo KDS com login por codigo consegue ver o modo Linha de Producao**, independente da configuracao.

## Solucao

Fazer o hook `useKdsSettings` aceitar um `tenantId` externo (vindo do dispositivo) como fallback, e fazer a pagina KDS fornecer esse `tenantId` a partir dos dados do device auth.

## Detalhes tecnicos

### 1. Armazenar o `tenant_id` no login do dispositivo

No arquivo `src/components/kds/KdsDeviceLogin.tsx`, o login ja recebe o objeto `device` que contem `tenant_id`. Basta armazena-lo no localStorage junto com os outros dados:

```text
KdsDeviceLogin.tsx
  - Adicionar tenant_id ao objeto authData salvo no localStorage
  - Atualizar getStoredDeviceAuth para retornar tenant_id
```

### 2. Passar `tenantId` do dispositivo para `useKdsSettings`

No arquivo `src/hooks/useKdsSettings.ts`:

```text
useKdsSettings.ts
  - Aceitar parametro opcional overrideTenantId
  - Usar overrideTenantId como fallback quando get_user_tenant_id() retorna null
  - Manter comportamento atual para usuarios logados normalmente
```

### 3. Atualizar a pagina KDS para fornecer o `tenantId`

No arquivo `src/pages/KDS.tsx`:

```text
KDS.tsx
  - Extrair tenant_id do deviceAuth
  - Passar para useKdsSettings como override
```

### 4. Fluxo corrigido

```text
Dispositivo faz login por codigo
  |
  v
Edge function retorna device com tenant_id
  |
  v
tenant_id salvo no localStorage
  |
  v
KDS.tsx le tenant_id do deviceAuth
  |
  v
useKdsSettings recebe overrideTenantId
  |
  v
Query busca kds_global_settings com o tenant correto
  |
  v
operationMode = 'production_line' carrega corretamente
  |
  v
KdsProductionLineView e renderizado
```

### Arquivos alterados

1. **src/components/kds/KdsDeviceLogin.tsx** - Salvar `tenant_id` no localStorage
2. **src/hooks/useKdsSettings.ts** - Aceitar `overrideTenantId` como parametro
3. **src/pages/KDS.tsx** - Passar `deviceAuth.tenantId` para o hook
