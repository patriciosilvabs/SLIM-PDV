

# Unificar selecao de sabores em um unico grupo

## Problema atual
Quando o cliente escolhe "2 sabores", o sistema mostra dois cards separados ("Pizza 1" e "Pizza 2"), cada um com o grupo de complementos repetido e selecao individual (radio button, 1 sabor por card). Isso confunde o usuario.

## Comportamento desejado
Mostrar o grupo de complementos UMA UNICA VEZ, mas com checkboxes que permitem selecionar a quantidade de sabores escolhida (ex: 2 sabores = 2 checkboxes marcaveis). Se o cliente escolheu 1 sabor, usa radio button (selecao unica). Se escolheu 2 sabores, usa checkboxes com limite de 2 selecoes.

## Alteracoes

### `src/components/order/ProductDetailDialog.tsx`

1. **Remover os cards PizzaUnitCard** para grupos per-unit quando `unitCount > 0`
2. **Substituir por uma unica secao** que renderiza o grupo de complementos uma vez, com `max_selections` ajustado para o `unitCount` (numero de sabores escolhido)
3. **Usar checkboxes** quando `unitCount > 1` (multipla selecao) e **radio buttons** quando `unitCount === 1` (selecao unica)
4. **Manter campo de observacoes** unico (em vez de um por pizza)
5. **Adaptar o calculo de preco** e a validacao para funcionar com a selecao unificada
6. **Adaptar o `handleAdd`** para gerar os `subItems` a partir das selecoes unificadas (cada sabor selecionado vira um sub-item para manter compatibilidade com o restante do sistema)

### Logica simplificada

```text
Se unitCount == 1:
  Mostra grupo com radio button (selecao unica, como antes)
  
Se unitCount == 2:
  Mostra grupo com checkboxes, limite de 2 selecoes
  Label: "Escolha ate 2 sabores"
  Contador: "0/2"

Ao adicionar:
  Cada sabor selecionado gera um sub_item separado para o pedido
  (mantendo compatibilidade com impressao e KDS)
```

### Sem alteracoes no banco de dados
Apenas mudanca visual/UX no `ProductDetailDialog`. A estrutura de dados enviada ao adicionar o item permanece compativel.

