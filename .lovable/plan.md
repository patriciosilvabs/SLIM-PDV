

# Correcao: Dispositivos KDS mostrando Kanban em vez de Linha de Producao e sem filtrar por praca

## Problema

Existem dois problemas conectados:

1. **Layout errado**: Dispositivos mostram Kanban (PENDENTE, EM PREPARO, PRONTO) em vez da "Linha de Producao" configurada
2. **Sem filtragem por praca**: Cada dispositivo deveria mostrar apenas os itens da sua praca atribuida (ex: BORDAS ve apenas itens de borda, BANCADA A ve apenas seus itens)

## Causa raiz

No modo device-only (login por codigo), o `useKdsSettings` tenta buscar configuracoes via query direta ao banco, mas o RLS bloqueia (sem sessao de usuario). Mesmo com o override no KDS.tsx, ha dois pontos de falha:

1. **Dentro do `KdsProductionLineView`**: O componente chama `useKdsSettings(overrideTenantId)` internamente. Mesmo com `overrideTenantId`, a query ao `kds_global_settings` falha por RLS (sem `auth.uid()`), fazendo o `operationMode` voltar para `'traditional'`
2. **Settings do dispositivo**: O `assignedStationId` vem do localStorage e funciona, mas como o componente nunca e renderizado (pois o KDS page ve `'traditional'` antes do deviceData carregar), a filtragem nunca acontece

## Solucao

### 1. Garantir que `kdsSettings.operationMode` use dados do Edge Function imediatamente

No `KDS.tsx`, o memo `kdsSettings` (linhas 131-163) ja faz o override correto, mas existe uma condicao de corrida: quando `deviceData.settings` ainda e `null` (carregando), volta para defaults. Vamos adicionar um estado de loading para nao renderizar o view errado enquanto os dados carregam.

### 2. Passar settings ja resolvidas para `KdsProductionLineView`

Em vez de deixar o componente chamar `useKdsSettings` internamente (que falha por RLS), passar as settings ja resolvidas como prop. O componente ja recebe `overrideTenantId`, mas isso nao resolve o problema do RLS.

### 3. Adicionar prop `overrideSettings` ao `KdsProductionLineView`

O componente recebera as settings completas (com `assignedStationId` e `operationMode` corretos) vindas do KDS page, eliminando a dependencia do hook que falha por RLS.

## Detalhes tecnicos

### Arquivo: `src/pages/KDS.tsx`

- Adicionar guarda de loading: enquanto `isDeviceOnlyMode && !deviceData.settings`, mostrar spinner em vez de renderizar Kanban
- Passar `kdsSettings` (ja com override) como prop para `KdsProductionLineView`

### Arquivo: `src/components/kds/KdsProductionLineView.tsx`

- Adicionar prop `overrideSettings` com as settings pre-resolvidas
- Quando `overrideSettings` estiver presente, usar em vez de chamar `useKdsSettings`
- Manter `assignedStationId` do localStorage como fallback

### Arquivo: `src/components/kds/KdsStationCard.tsx`

- `KdsStationCard` tambem chama `useKdsSettings()` internamente (linha 202) para `hasSpecialBorder` e `settings.showPartySize`
- Passar essas configs como props em vez de depender do hook bloqueado por RLS

### Fluxo corrigido

```text
Dispositivo faz login por codigo
  |
  v
KDS.tsx detecta isDeviceOnlyMode
  |
  v
useKdsDeviceData busca orders + settings + stations via Edge Function
  |
  v
kdsSettings memo combina deviceData.settings + localStorage
  |
  v
operationMode = 'production_line' (do Edge Function)
assignedStationId = station_id do dispositivo (do localStorage)
  |
  v
Renderiza KdsProductionLineView com overrideSettings
  |
  v
Componente filtra itens pela praca do dispositivo
  |
  v
BORDAS ve so itens na praca "Preparando Massa e Borda"
BANCADA A ve so itens na praca "Preparando Recheio"
DESPACHO ve so pedidos prontos
```

### Arquivos alterados

1. **src/pages/KDS.tsx** - Guarda de loading + passar settings como prop
2. **src/components/kds/KdsProductionLineView.tsx** - Aceitar `overrideSettings` prop
3. **src/components/kds/KdsStationCard.tsx** - Receber configs relevantes como props em vez de chamar useKdsSettings internamente

