

# Seletor de Quantidade de Sabores para Pizza

## Problema Atual
Hoje, quando o cliente clica em uma pizza, o sistema usa o campo `unit_count` fixo do grupo de complementos para determinar quantas unidades (sabores) a pizza tem. Isso significa que para oferecer "1 sabor" e "2 sabores", seria necessario cadastrar dois produtos separados.

## Solucao Proposta
Adicionar um passo intermediario no fluxo de pedido: quando o cliente clicar em um produto que possui grupos de complemento com `applies_per_unit = true`, o sistema exibe primeiro um modal perguntando quantos sabores ele deseja. Depois, abre o ProductDetailDialog com o `unitCount` dinamico.

## Fluxo do Cliente

```text
[Clica na Pizza]
       |
       v
+---------------------+
| Quantos sabores?    |
|                     |
| [1 Sabor] [2 Sabores] |
+---------------------+
       |
       v
+---------------------+
| ProductDetailDialog |
| com N PizzaUnitCards|
+---------------------+
```

## Mudancas Tecnicas

### 1. Novo componente: `PizzaFlavorCountDialog`
**Arquivo:** `src/components/order/PizzaFlavorCountDialog.tsx`

- Modal simples com titulo "Quantos sabores?"
- Botoes grandes e visuais: "1 Sabor" e "2 Sabores" (baseado no `max_unit_count` ou fixo em 2)
- Ao selecionar, chama callback com o numero escolhido
- Visual inspirado na imagem de referencia: cards com imagem e descricao

### 2. Modificar `ProductDetailDialog`
**Arquivo:** `src/components/order/ProductDetailDialog.tsx`

- Adicionar prop opcional `overrideUnitCount?: number`
- Quando `overrideUnitCount` for passado, usar esse valor ao inves do `unit_count` do grupo de complementos
- Isso permite que o dialog funcione com 1 ou 2 sabores sem alterar o cadastro

### 3. Modificar fluxo no `Counter.tsx`
**Arquivo:** `src/pages/Counter.tsx`

- Antes de abrir o `ProductDetailDialog`, verificar se o produto tem grupos com `applies_per_unit = true`
- Se sim, abrir primeiro o `PizzaFlavorCountDialog`
- Quando o usuario escolher, abrir o `ProductDetailDialog` passando `overrideUnitCount`
- Se nao tem grupos per-unit, abrir direto o `ProductDetailDialog` (comportamento atual)

### 4. Modificar fluxo no `ProductSelector.tsx` (Mesas)
**Arquivo:** `src/components/tables/ProductSelector.tsx`

- Mesma logica do Counter: interceptar clique em produto pizza
- Mostrar `PizzaFlavorCountDialog` antes do `ProductDetailDialog`

### 5. Hook auxiliar para detectar produto pizza
- Usar o hook `useProductComplements` para verificar se o produto tem grupos `applies_per_unit`
- Alternativa: fazer um pre-fetch leve dos grupos vinculados ao clicar no produto

## Detalhes de Implementacao

### PizzaFlavorCountDialog - Layout
- Dialog com fundo escuro
- Titulo: "Escolha o tipo de pizza" ou nome do produto
- Dois cards lado a lado (similar a imagem de referencia):
  - Card "1 Sabor" - com icone de pizza inteira
  - Card "2 Sabores" - com icone de pizza dividida
- Cada card mostra o preco base "A partir de R$ XX,XX"

### Logica de preco
- Para 1 sabor: preco normal do produto + complemento escolhido
- Para 2 sabores: preco do produto + calculo baseado no `price_calculation_type` do grupo (average = media dos dois sabores, highest = sabor mais caro)

### Impacto no cadastro
- Nenhuma mudanca no banco de dados
- O cadastro do produto permanece unico
- O campo `unit_count` do complement group pode ser usado como "maximo de sabores permitidos"
- O sistema apenas varia dinamicamente quantos PizzaUnitCards exibir

## Ordem de Implementacao
1. Criar componente `PizzaFlavorCountDialog`
2. Adicionar prop `overrideUnitCount` no `ProductDetailDialog`
3. Integrar no `Counter.tsx`
4. Integrar no `ProductSelector.tsx` (mesas)
5. Testar fluxo completo

