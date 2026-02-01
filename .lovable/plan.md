
# Plano: Sistema de Ficha Técnica para Opções de Complemento

## Visão Geral

Implementar vinculação de ingredientes (insumos porcionados) nas **Opções de Complemento** para que o sistema calcule a baixa exata de estoque quando uma pizza é vendida.

**Exemplo concreto:**
- Pizza Grande 1 Sabor = Produto base (consome **Massa**)
- Sabor Calabresa = Opção de complemento (consome **Mussarela** + **Calabresa**)
- Resultado: Venda baixa automaticamente 1 Massa + 1 Mussarela + 1 Calabresa

## Arquitetura da Solução

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                          FLUXO DE BAIXA DE ESTOQUE                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  VENDA NO PDV                                                            │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────────┐                                                 │
│  │ Pizza Grande 1 Sabor│ ──► product_ingredients ──► MASSA (1 porção)   │
│  └─────────────────────┘                                                 │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─────────────────────┐                                                 │
│  │ Sabor: Calabresa    │ ──► complement_option_ingredients              │
│  └─────────────────────┘          ├── MUSSARELA (1 porção)              │
│                                   └── CALABRESA (1 porção)              │
│                                                                          │
│       ▼                                                                  │
│  ┌─────────────────────┐                                                 │
│  │ TRIGGER DE BAIXA    │ ──► stock_movements                            │
│  │ (order_item_extras) │          └── 3 movimentações de saída          │
│  └─────────────────────┘                                                 │
│                                                                          │
│       ▼                                                                  │
│  ┌─────────────────────┐                                                 │
│  │ CPD VIA API        │ ◄── Consulta demanda em tempo real              │
│  └─────────────────────┘                                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Etapas de Implementação

### 1. Banco de Dados

**Nova Tabela: `complement_option_ingredients`**

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | Chave primária |
| complement_option_id | uuid | FK para complement_options |
| ingredient_id | uuid | FK para ingredients |
| quantity | numeric | Quantidade consumida por unidade |
| tenant_id | uuid | FK para tenants |
| created_at | timestamp | Data de criação |

**Políticas RLS:**
- Admins do tenant podem gerenciar
- Membros do tenant podem visualizar

**Nova Trigger: `auto_deduct_stock_for_extras`**
- Dispara em INSERT na `order_item_extras`
- Busca ingredientes da opção via `complement_option_ingredients`
- Registra movimentação de saída em `stock_movements`

### 2. Backend (Hooks)

**Novo Hook: `useComplementOptionIngredients`**
- `useComplementOptionIngredients(optionId)` - Lista ingredientes de uma opção
- `useComplementOptionIngredientMutations()` - CRUD para vínculos

**Funções:**
- `addIngredient({ complement_option_id, ingredient_id, quantity })`
- `updateIngredient({ id, quantity })`
- `removeIngredient(id)`

### 3. Interface do Usuário

**Atualização: `ComplementOptionDialog.tsx`**

Adicionar nova aba "Ficha Técnica" (ou seção expandível) com:
- Lista de ingredientes vinculados à opção
- Botão para adicionar ingrediente
- Select para escolher ingrediente da lista
- Input para quantidade
- Botão para remover ingrediente

```text
┌──────────────────────────────────────────────────────────────────┐
│ Editar opção: Calabresa                                          │
├──────────────────────────────────────────────────────────────────┤
│ [Imagem] [Nome] [Preço] [Descrição]                              │
├──────────────────────────────────────────────────────────────────┤
│ FICHA TÉCNICA (Insumos)                                          │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Mussarela      │ 0.150 kg  │ [Remover]                       │ │
│ │ Calabresa      │ 0.100 kg  │ [Remover]                       │ │
│ ├──────────────────────────────────────────────────────────────┤ │
│ │ [Select ingrediente] [Qtd] [+ Adicionar]                     │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 4. Atualização da API de Produção

**Endpoint: `production-api?action=demand`**

Atualizar para considerar também os ingredientes das opções de complemento:
- Atual: Só calcula demanda baseada em `product_ingredients`
- Novo: Também consulta `complement_option_ingredients` para calcular demanda dos sabores

## Detalhes Técnicos

### Trigger de Baixa de Estoque para Extras

```sql
-- Pseudocódigo da trigger
CREATE OR REPLACE FUNCTION auto_deduct_stock_for_extras()
RETURNS trigger AS $$
DECLARE
  option_ingredient RECORD;
  order_item_record RECORD;
  ingredient_record RECORD;
  deduction_quantity NUMERIC;
BEGIN
  -- Buscar order_item para obter tenant_id e quantity
  SELECT oi.quantity, o.tenant_id, o.is_draft
  INTO order_item_record
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE oi.id = NEW.order_item_id;
  
  -- Só processar se não for rascunho
  IF order_item_record.is_draft THEN
    RETURN NEW;
  END IF;
  
  -- Buscar ingredientes da opção de complemento
  FOR option_ingredient IN
    SELECT coi.ingredient_id, coi.quantity as recipe_quantity
    FROM complement_option_ingredients coi
    WHERE coi.complement_option_id = NEW.extra_id
      AND coi.tenant_id = order_item_record.tenant_id
  LOOP
    -- Calcular e baixar estoque (similar à trigger existente)
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Ordem das Operações

1. **Venda no PDV** → Cria `order_items`
2. **Trigger 1** (`auto_deduct_stock_for_order_item`) → Baixa ingredientes do produto base
3. **Insert** em `order_item_extras` → Registra os sabores escolhidos
4. **Trigger 2** (`auto_deduct_stock_for_extras`) → Baixa ingredientes dos sabores
5. **CPD** via API → Consulta demanda atualizada

## Arquivos a Serem Criados/Modificados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| **Migração SQL** | Criar | Tabela `complement_option_ingredients` + trigger |
| `src/hooks/useComplementOptionIngredients.ts` | Criar | Hook para CRUD de ingredientes da opção |
| `src/components/menu/ComplementOptionDialog.tsx` | Modificar | Adicionar seção de ficha técnica |
| `supabase/functions/production-api/index.ts` | Modificar | Incluir demanda dos complementos |

## Considerações de Segurança

- RLS garante isolamento por tenant
- Trigger usa SECURITY DEFINER para operações cross-table
- API valida permissões via API key
