

# Corrigir calculo de preco para pizza com multiplos sabores

## Problema
Quando o cliente escolhe 2 sabores, o sistema soma os precos dos dois sabores. O comportamento correto eh calcular a media: (preco sabor 1 + preco sabor 2) / 2.

Exemplo: Sabor A = R$40, Sabor B = R$50 --> Resultado esperado: R$45 (media), nao R$90 (soma).

## Causa raiz
O grupo "Sabores" esta configurado com `price_calculation_type = 'sum'` no banco de dados. Porem, para grupos per-unit (sabores de pizza), quando ha mais de 1 unidade, o calculo deveria forcar o uso de media automaticamente.

## Solucao

### Alterar `src/components/order/ProductDetailDialog.tsx`

Na funcao `calculatePerUnitPrice` (linha ~310), quando o `unitCount > 1`, forcar o calculo como **media** independentemente do `price_calculation_type` configurado no grupo. Isso porque, para pizza com multiplos sabores, o padrao de mercado eh cobrar a media dos sabores.

Logica atualizada:

```text
calculatePerUnitPrice():
  para cada grupo per-unit:
    se unitCount > 1:
      usar calculo 'average' (media dos sabores selecionados)
    senao:
      usar o price_calculation_type configurado no grupo (comportamento normal)
```

### Detalhe tecnico

Alterar a funcao `calculatePerUnitPrice` de:

```
total += calculateGroupPrice(group.id, group.price_calculation_type);
```

Para:

```
const effectiveType = unitCount > 1 ? 'average' : group.price_calculation_type;
total += calculateGroupPrice(group.id, effectiveType);
```

Isso garante que:
- Pizza de 1 sabor: usa o calculo normal do grupo
- Pizza de 2+ sabores: sempre calcula a media dos precos

### Sem alteracoes no banco de dados
Apenas uma mudanca de logica no componente. O `price_calculation_type` do grupo permanece como esta.

