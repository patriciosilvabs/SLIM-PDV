

# Desmembrar Pedidos: Distribuicao Individual de Itens entre Bancadas

## O que muda

Atualmente, quando um pedido com 2+ itens (ex: Pedido 0040 com Pizza Calabresa + Pizza Mussarela) e confirmado, **todos os itens sem borda vao para a MESMA bancada de preparo**. O sistema escolhe a bancada menos ocupada e envia tudo junto.

Com esta mudanca, **cada item sera distribuido individualmente** para a bancada menos ocupada no momento da atribuicao. Isso significa que:
- Pizza Calabresa pode ir para Bancada A
- Pizza Mussarela pode ir para Bancada B

O pedido so sera marcado como "pronto" quando TODOS os itens individuais chegarem ao despacho.

## Mudancas Tecnicas

### 1. Trigger `assign_station_on_order_confirm` (Migration SQL)

Alterar a logica de "escolher UMA bancada para o pedido inteiro" para "escolher a bancada menos ocupada POR ITEM":

- Remover a variavel `target_prep_id` que e calculada antes do loop
- Dentro do loop `FOR item_record`, recalcular o balanceamento para CADA item individualmente
- Apos atribuir um item a uma bancada, o contador daquela bancada sobe, garantindo que o proximo item va para outra se estiverem equilibradas

### 2. Trigger `auto_initialize_new_order_item` (Migration SQL)

Este trigger ja funciona por item individual (disparado no INSERT de cada order_item), entao ja distribui corretamente. Nenhuma mudanca necessaria.

### 3. Edge Function `kds-data/index.ts`

A funcao `smart_move_item` ja opera por item individual. Nenhuma mudanca necessaria.

### 4. Hook `useKdsWorkflow.ts`

O hook ja opera por item. Nenhuma mudanca necessaria.

---

## Resumo

| Componente | Mudanca |
|---|---|
| Trigger `assign_station_on_order_confirm` | Balanceamento POR ITEM em vez de por pedido |
| Trigger `auto_initialize_new_order_item` | Nenhuma (ja funciona por item) |
| Edge Function `smart_move_item` | Nenhuma (ja funciona por item) |
| Hook `useKdsWorkflow` | Nenhuma (ja funciona por item) |

A unica mudanca real e no trigger SQL que roda quando o pedido e confirmado (`is_draft = false`).

