# SLIM-PDV -> Firebase Migration

## Current state
- Frontend and business hooks are heavily coupled to Supabase client.
- Backend logic is implemented in `supabase/functions/*`.
- Data model and security are in `supabase/migrations/*.sql` (PostgreSQL + RLS).

## Authentication status
- Authentication has been migrated to Firebase through a compatibility layer in `src/integrations/supabase/client.ts`.
- Existing calls to `supabase.auth.*` now execute Firebase Auth flows:
  - sign in / sign up / sign out
  - password recovery and password update
  - OAuth Google sign-in
  - auth state subscriptions and session retrieval

## Functions status
- `supabase.functions.invoke(...)` now routes to Firebase Functions first.
- Function name compatibility is automatic (`create-user` -> `createUser`, etc).
- The frontend no longer falls back to Supabase directly.
- Some Firebase Functions still proxy server-side to Supabase Edge Functions through `SUPABASE_URL` until each endpoint is rewritten natively.
- Firebase Functions already implemented:
  - `health`
  - `createUser`
  - `adminUpdateUser`
  - `adminDeleteUser`
  - `deleteUser`
  - `qzSign` (requires `QZ_PRIVATE_KEY`, `QZ_PRIVATE_KEY_BASE64` or `QZ_PRIVATE_KEY_PATH` in functions runtime)
- Remaining function endpoints that are not native yet are exposed through Firebase Functions and proxy server-side via `SUPABASE_URL`.

## QZ Tray certificate
- Public certificate is served by Hosting at `/qz/digital-certificate.txt`.
- The signing private key stays only in `functions/.env`.
- For workstation-level trust without prompts, register the certificate locally with `qz-tray-console.exe --whitelist "<path-to-digital-certificate.txt>"`.

## Firebase foundation added
- Frontend Firebase client: `src/integrations/firebase/client.ts`
- Firebase project config: `.firebaserc`, `firebase.json`
- Firestore + Storage rules: `firestore.rules`, `firestore.indexes.json`, `storage.rules`
- Cloud Functions (TypeScript) scaffold: `functions/*`

## Migration map
- Supabase Auth -> Firebase Authentication
- Supabase tables/RLS -> Firestore collections + Security Rules
- Supabase Storage -> Firebase Storage + Storage Rules
- Supabase Edge Functions -> Firebase Cloud Functions (HTTP/callable)

## Suggested execution order
1. Setup project and emulators
1. Migrate tenant/profile collections
1. Migrate order/menu/cash-register flows
1. Migrate integrations/webhooks (CardapioWeb, production API, notifications)
1. Remove Supabase dependencies after parity

## Function mapping (initial)
- `supabase/functions/cardapioweb-webhook` -> `functions/src/index.ts::cardapiowebWebhook`
- `supabase/functions/production-webhook` -> `functions/src/index.ts::productionWebhook`
- `supabase/functions/public-store` -> `functions/src/index.ts::publicStore`

## Notes
- Firestore rules were intentionally created with deny-by-default until each module is migrated.
- Keep Supabase active during migration to avoid production regressions.
