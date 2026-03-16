# Status da Migracao Completa (Supabase -> Firebase)

Data de referencia: 2026-03-12

## Concluido
- Autenticacao completa migrada para Firebase (`supabase.auth.*` compat).
- Funcoes migradas para Firebase Functions sem fallback para Supabase.
- Storage no frontend migrado (`storage_calls=0`).
- Realtime por canais removido (`channel_calls=0`) com polling controlado.
- Chamada RPC direta removida (`rpc_calls=0`).
- Chamadas diretas `.from(...)` removidas do frontend (`from_calls=0`).
- Chamadas diretas `.db(...)` removidas do frontend (`table_calls=0` e busca textual zerada em `src`).
- Frontend desacoplado para camada de acesso `.table(...)` (adapter), mantendo compatibilidade atual.
- Fluxos de identidade e tenancy migrados para Firestore helper:
  - `profiles`
  - `tenant_members`
  - `user_roles`
  - `tenant_invitations`
  - `tenants` (principais fluxos de criacao/edicao/consulta)
  - `platform_admins`
- Blocos adicionais migrados para Firestore helper:
  - `complement_groups`
  - `complement_options`
  - `complement_group_options`
  - `product_complement_groups`
  - `products` (hook principal de consulta/CRUD)
  - `print_sectors` (hook principal de consulta/CRUD)
  - `order_reopens`, `table_switches` e remocao de `order_items` com limpeza de relacionamentos
  - `print_queue`, `scheduled_announcements`, `unmapped_sales` (hooks principais migrados)
  - `useTableSwitches` e parte de `useAuditEvents` (reopen/switch) em helper Firebase
  - `production_api_keys`, `production_targets`, `production_shipments` e `production_demand` (tenant)
  - `tables`
  - `ingredients`
  - `usePerformance`, `useDashboard`, `useReports` (analytics/indicadores)
  - `useAuditEvents` (incluindo cancelamentos), `useCancellationHistory`, `useClosingHistory`
  - `useCashRegister`, `useMonthlyRevenue`, `useDataCache`
  - `useCardapioWebIntegration` (integracao, mapeamentos e logs)
  - `useOrders`, `useKdsWorkflow`, `useKdsStationLogs`, `useOfflineSync`
  - `usePlatformAdmin`, `useProductionDemand`
  - `pages/Tables.tsx`, `pages/KDS.tsx`, `pages/Counter.tsx`
  - `components/kds/KdsStationHistory.tsx`, `components/kitchen/KitchenOrderTicket.tsx`

## Auditoria atual
- `from_calls=0`
- `table_calls=0`
- `storage_calls=0`
- `rpc_calls=0`
- `channel_calls=0`

## Interpretacao
- A dependencia de sintaxe direta do Supabase foi removida dos pontos criticos (`from/table/rpc/channel/storage`).
- O bloco de autenticacao e multi-tenant foi migrado para Firebase CRUD helper.
- O frontend opera sem chamadas literais `supabase.from/table/rpc/channel/storage` no codigo da aplicacao.
- O frontend tambem opera sem chamadas literais `supabase.db(...)` em `src`.
- Endpoints HTTP de Functions no frontend foram normalizados para URL Firebase (`getFirebaseFunctionUrl`), sem dependencia de `VITE_SUPABASE_URL` no runtime do frontend.
- Fallback de `functionsClient.invoke` para Supabase foi removido; chamadas seguem apenas para Firebase Functions.
- A migracao incremental de acesso a dados do frontend foi concluida para os padroes auditados.
- O alias principal do client na aplicacao foi consolidado para `backendClient` (`src/integrations/backend/client.ts`), deixando `supabase` apenas como compatibilidade residual da camada de integracao.
- O client compat residual nao instancia mais `@supabase/supabase-js` para runtime do frontend; `db/table/rpc` legados agora falham explicitamente se reintroduzidos.
- A dependencia `@supabase/supabase-js` foi removida do projeto frontend.
- O projeto frontend esta configurado para o Firebase `slimpdv-manus` via `VITE_FIREBASE_*` em `.env`.

## Proximo alvo tecnico (opcional)
1. Consolidar nomenclatura do client compat (`src/integrations/supabase/client.ts`) para um modulo explicitamente Firebase.
1. Revisar indexes e modelagem do Firestore para consultas globais de plataforma e analytics consolidados.
