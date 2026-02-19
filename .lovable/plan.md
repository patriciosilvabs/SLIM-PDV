
# Integrar modal de sabores no OrderDrawer (mobile)

## Problema
Ao clicar em um produto pizza no OrderDrawer (tela mobile), o sistema abre diretamente o ProductDetailDialog sem perguntar quantos sabores o cliente quer. O modal de selecao de sabores (PizzaFlavorCountDialog) so funciona no ProductSelector (desktop) e no Counter, mas nao no OrderDrawer.

## Solucao
Adicionar a mesma logica de deteccao de pizza que existe no `ProductSelector.tsx` ao `OrderDrawer.tsx`:

### Alteracoes em `src/components/tables/OrderDrawer.tsx`

1. **Importar** `PizzaFlavorCountDialog` e `usePizzaProducts`
2. **Adicionar estados**:
   - `flavorDialogOpen` para controlar o modal de sabores
   - `overrideUnitCount` para passar a quantidade escolhida ao ProductDetailDialog
3. **Modificar `handleProductClick`**: verificar se o produto tem configuracao de pizza (`flavorModalEnabled` e canal `table`). Se sim, abrir o `PizzaFlavorCountDialog` em vez do `ProductDetailDialog`
4. **Adicionar `handleFlavorSelect`**: ao escolher quantidade de sabores, definir `overrideUnitCount` e abrir o `ProductDetailDialog`
5. **Renderizar** o componente `PizzaFlavorCountDialog` no JSX
6. **Passar `overrideUnitCount`** e `channel="table"` ao `ProductDetailDialog`

### Logica (copiada do ProductSelector)

```text
handleProductClick(product):
  config = pizzaData.configMap.get(product.id)
  if config AND config.flavorModalEnabled AND config.flavorModalChannels.includes('table'):
    abrir PizzaFlavorCountDialog
  else:
    abrir ProductDetailDialog normalmente

handleFlavorSelect(count):
  overrideUnitCount = count
  abrir ProductDetailDialog
```

### Sem alteracoes no banco de dados
Nenhuma mudanca de schema necessaria. Apenas alinhamento da UI mobile com a logica que ja existe no desktop.
