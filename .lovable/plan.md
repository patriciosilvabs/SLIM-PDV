
# Plano: Botao "PRONTO!" no Despacho

## Resumo

Alterar o texto do botao na estacao de despacho para sempre exibir **"PRONTO!"**, independentemente do tipo de pedido (Mesa, Delivery ou Retirada). Atualmente, pedidos de mesa mostram "Servir Mesa" e o card de reagrupamento mostra "Finalizar Pedido".

## Mudancas

### 1. KdsStationCard.tsx (linha 363-367)

Remover a condicao especial para `dine_in` na estacao `order_status`. O botao da estacao de despacho passara a mostrar sempre "Pronto" em vez de "Servir Mesa".

### 2. KdsOrderStatusCard.tsx (linhas 279-282)

Alterar o texto do botao de finalizacao do card reagrupado:
- De: "Finalizar Pedido" / "Servir X itens restantes"
- Para: **"PRONTO!"** quando todos os itens chegaram e foram servidos
- Manter "Aguardando X itens..." quando ainda ha itens em producao
- Manter "Servir X itens restantes" quando itens chegaram mas nao foram marcados

### Arquivos modificados

- `src/components/kds/KdsStationCard.tsx`
- `src/components/kds/KdsOrderStatusCard.tsx`
