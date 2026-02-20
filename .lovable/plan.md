

# Plano: Aplicar Visual do KDS do "Janela de Pedidos" na Nossa Aplicacao

## Resumo

O sistema de referencia (janeladepedidos) tem uma hierarquia visual clara e eficiente nos cards do KDS que facilita a leitura rapida pela cozinha. Vamos adaptar esse estilo visual ao nosso sistema, mantendo nossa arquitetura de estacoes/pracas.

## Diferencas Principais Identificadas

| Aspecto | Referencia (janeladepedidos) | Nosso Sistema Atual |
|---------|------------------------------|---------------------|
| Sabores | **Texto grande e bold (text-2xl)** | Texto pequeno azul com emoji |
| Borda | **Tarja LARANJA piscante** (bg-orange-600, texto branco) | Badge configuravel (pequeno) |
| Observacoes | **Tarja VERMELHA piscante** com icone de alerta | Badge configuravel (pequeno) |
| Complementos | Lista simples em texto | Misturado nos badges |
| Nome produto | Texto pequeno (xs) acima dos sabores | Texto medio como foco principal |

## O Que Vai Mudar

### 1. Hierarquia Visual nos Cards (KdsStationCard.tsx)

Reordenar e redimensionar os elementos de cada item seguindo o padrao da referencia:

```text
+-----------------------------------------+
| 2x Pizza Grande                         |  <- Quantidade + Produto (texto menor)
|                                         |
| Calabresa + Mussarela                   |  <- SABORES em texto GRANDE e BOLD
|                                         |
| [  BORDA DE CHOCOLATE  ]  (piscante)    |  <- Tarja LARANJA piscante
|                                         |
| Massa fina, Azeitona extra              |  <- Complementos em texto normal
|                                         |
| [ OBS: SEM CEBOLA ]  (piscante)        |  <- Tarja VERMELHA piscante
|                                         |
|  [ PROXIMO >>> ]                        |  <- Botao de acao
+-----------------------------------------+
```

### 2. Componente KdsItemBadges.tsx

Atualizar os badges para usar o estilo visual da referencia:
- **Borda**: fundo laranja solido (bg-orange-600), texto branco, bold, animate-pulse
- **Observacoes**: fundo vermelho solido (bg-red-600), texto branco, bold, animate-pulse, com icone de alerta

### 3. Sabores com Destaque

Mudar a exibicao de sabores de `text-sm text-blue-600` para `text-2xl font-bold text-foreground` - tornando os sabores o elemento de maior destaque visual no card (como na referencia).

### 4. Complementos Separados

Extrair e exibir complementos (extras com `kds_category === 'complement'` ou sem categoria) como texto simples abaixo dos sabores, separados das badges de borda/observacoes.

## Detalhes Tecnicos

### Arquivos a Modificar

1. **`src/components/kds/KdsStationCard.tsx`**
   - Refatorar `renderItemContent()` para seguir a nova hierarquia visual
   - Sabores: `text-2xl font-bold` (era `text-sm text-blue-600`)
   - Adicionar secao de complementos (extras que nao sao sabor nem borda)
   - Manter logica existente de extracoes (getFlavors, getItemNotes)

2. **`src/components/kds/KdsItemBadges.tsx`**
   - Borda: `bg-orange-600 text-white font-bold animate-pulse` (estilo solido)
   - Observacoes: `bg-red-600 text-white font-bold animate-pulse` com `⚠️ OBS:` prefixo
   - Remover fundo semi-transparente, usar cores solidas como na referencia

3. **`src/components/kds/KdsReadOnlyOrderCard.tsx`** (se existir renderizacao similar)
   - Aplicar mesma hierarquia visual para consistencia

### Logica de Extracao de Complementos (nova)

```typescript
const getComplements = (item: OrderItem): string[] => {
  const complements: string[] = [];
  // Extras que nao sao sabor nem borda
  item.extras?.filter(e => 
    e.kds_category !== 'flavor' && e.kds_category !== 'border'
  ).forEach(e => {
    const parts = e.extra_name.split(':');
    complements.push(parts.length > 1 ? parts[1].trim() : e.extra_name);
  });
  // Sub_items complementos
  item.sub_items?.flatMap(si => si.sub_extras || [])
    .filter(se => se.kds_category !== 'flavor' && se.kds_category !== 'border')
    .forEach(se => {
      const parts = se.option_name.split(':');
      complements.push(parts.length > 1 ? parts[1].trim() : se.option_name);
    });
  return complements;
};
```

## O Que NAO Muda

- Arquitetura de estacoes/pracas (stations) - permanece igual
- Fluxo de movimentacao de itens (useKdsWorkflow) - permanece igual
- Logica de extracao de sabores e bordas (getFlavors, getBorderInfo) - permanece igual
- Modo kanban vs linha de producao - permanece igual
- Configuracoes de KDS (cores, sons, etc) - permanecem iguais

