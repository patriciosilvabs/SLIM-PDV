

# Classificacao Inteligente de Complementos no KDS via Codigo de Grupo

## Problema Atual

O KDS identifica o que e sabor, borda ou complemento usando **busca por palavras** no texto do `extra_name` (ex: procura "borda", "massa", "sabor"). Isso e fragil: se o nome mudar (ex: "Recheio de Borda" para "Stuffed Crust"), o sistema para de funcionar.

## Solucao Proposta

Adicionar um campo **`kds_category`** na tabela `complement_groups` com valores pre-definidos:

- `flavor` -- Sabores (ex: Calabresa, Margherita)
- `border` -- Bordas (ex: Borda de Chocolate)
- `complement` -- Complementos gerais (ex: Bacon extra)

O KDS usara esse campo para classificar corretamente cada item, em vez de adivinhar pelo nome.

## Como vai funcionar para voce

1. Na tela de edicao de cada **grupo de complementos**, aparecera um novo campo "Categoria KDS" com as opcoes acima
2. O KDS automaticamente mostrara:
   - Sabores em azul com icone de sabor
   - Bordas com destaque piscante (como ja funciona hoje, mas sem depender do nome)
   - Complementos normais como extras simples
3. Observacoes do item continuam aparecendo como ja aparecem (campo `notes`)

## Detalhes Tecnicos

### 1. Migracao de banco de dados
Adicionar coluna `kds_category` na tabela `complement_groups`:
- Tipo: `text`
- Default: `'complement'`
- Valores permitidos: `flavor`, `border`, `complement`

### 2. Propagacao da categoria no pedido
Quando um pedido e salvo, a tabela `order_item_extras` atualmente recebe apenas `extra_name` e `price`. A alteracao sera:
- Adicionar coluna `kds_category` em `order_item_extras` (texto, default `'complement'`)
- Adicionar coluna `kds_category` em `order_item_sub_item_extras` (texto, default `'complement'`)
- No momento da criacao do pedido (Counter.tsx, Tables.tsx), incluir a `kds_category` do grupo junto com os extras

### 3. Atualizacao do KDS
Substituir toda a logica de string matching nos componentes KDS:
- `KdsItemBadges.tsx` -- usar `kds_category` em vez de buscar "borda"/"massa" no nome
- `KdsStationCard.tsx` -- usar `kds_category` para classificar sabores
- `KdsReadOnlyOrderCard.tsx` -- idem
- `KdsKanbanReadOnly.tsx` -- idem
- `KdsProductionLineReadOnly.tsx` -- idem

### 4. Interface de configuracao
No dialogo de edicao do grupo de complementos (`ComplementGroupDialog.tsx`), adicionar um Select com as opcoes:
- Sabor (flavor)
- Borda (border)
- Complemento (complement)

### 5. Impressao de cozinha
Atualizar `KitchenReceipt.tsx` e `escpos.ts` para usar a categoria ao formatar o ticket, mostrando sabores e bordas de forma diferenciada.

### Arquivos que serao modificados
- `complement_groups` (migracao SQL)
- `order_item_extras` (migracao SQL)
- `order_item_sub_item_extras` (migracao SQL)
- `src/components/menu/ComplementGroupDialog.tsx`
- `src/hooks/useProductComplements.ts`
- `src/hooks/useOrders.ts`
- `src/pages/Counter.tsx`
- `src/pages/Tables.tsx`
- `src/components/kds/KdsItemBadges.tsx`
- `src/components/kds/KdsStationCard.tsx`
- `src/components/kds/KdsReadOnlyOrderCard.tsx`
- `src/components/kds/KdsKanbanReadOnly.tsx`
- `src/components/kds/KdsProductionLineReadOnly.tsx`
- `src/components/kitchen/KitchenReceipt.tsx`

