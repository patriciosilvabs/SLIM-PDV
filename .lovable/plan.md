

# Plano: Finalização do SISPRO - Fase 4 e 5

## Resumo

Este plano completa a implementação do Sistema de Automação de Estoque e Produção, integrando as partes que ainda faltam:

1. Adicionar menu de navegação para a página de Produção
2. Atualizar o webhook do CardápioWeb para baixa automática de estoque
3. Registrar as novas permissões no sistema TypeScript
4. Aplicar verificações de permissão nos componentes

---

## Fase 4: Integração com Webhook CardápioWeb

### 4.1 Atualizar Edge Function `cardapioweb-webhook/index.ts`

Após criar cada `order_item`, adicionar lógica para:

1. **Buscar ficha técnica** do produto via `product_ingredients`
2. **Para cada ingrediente**: registrar movimentação de saída em `stock_movements` e decrementar `current_stock` em `ingredients`
3. **Se não houver ficha técnica**: registrar em `unmapped_sales` para revisão posterior

Modificações:
- Adicionar função helper `deductStockForOrderItem()`
- Integrar após linha ~303 onde o `orderItem` é criado
- Usar o `order_id` para rastreabilidade

---

## Fase 5: Sistema de Permissões

### 5.1 Atualizar `useUserPermissions.ts`

Adicionar ao tipo `PermissionCode`:
- `production_view` - Visualizar dashboard de produção
- `production_manage` - Confirmar envios e fazer ajustes
- `targets_manage` - Configurar metas diárias de produção

Adicionar ao objeto `PERMISSION_GROUPS`:
```
production: {
  label: 'Produção (CPD)',
  permissions: [
    { code: 'production_view', label: 'Acessar dashboard de produção' },
    { code: 'production_manage', label: 'Confirmar envios de produção' },
    { code: 'targets_manage', label: 'Gerenciar metas de produção' },
  ],
},
```

---

## Fase 6: Navegação e UI

### 6.1 Atualizar `PDVLayout.tsx`

Adicionar item de navegação para `/production`:
```
{ 
  name: 'Produção', 
  href: '/production', 
  icon: Factory, 
  roles: ['admin'], 
  permission: 'production_view' 
}
```

Posição: Entre "Estoque" e "Caixa" (ou em posição relevante para operações)

### 6.2 Atualizar `SettingsSidebar.tsx`

Adicionar item para metas de produção (se ainda não estiver):
- Verificar permissão `targets_manage` para exibir

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/cardapioweb-webhook/index.ts` | Adicionar baixa automática de estoque |
| `src/hooks/useUserPermissions.ts` | Adicionar novas permissões de produção |
| `src/components/layout/PDVLayout.tsx` | Adicionar menu Produção |
| `src/pages/Production.tsx` | Usar permissão `production_view` em vez de role |
| `src/components/settings/ProductionTargetsSettings.tsx` | Verificar permissão `targets_manage` |
| `src/components/production/ShipmentConfirmDialog.tsx` | Verificar permissão `production_manage` |

---

## Fluxo de Teste

Após a implementação, você poderá testar:

1. **Acesso ao Menu**: Verificar se "Produção" aparece no menu lateral
2. **Configuração de Metas**: Ir em Configurações → Metas de Produção e definir quantidades por dia
3. **Dashboard de Produção**: Acessar `/production` e ver demanda calculada
4. **Envio de Produção**: Clicar em "Enviar" para registrar entrada de estoque
5. **Baixa Automática (webhook)**: Quando pedido do CardápioWeb chegar, estoque será decrementado automaticamente
6. **Vendas Sem Mapeamento**: Verificar alerta de itens sem ficha técnica

---

## Ordem de Execução

1. Atualizar `useUserPermissions.ts` (permissões TS)
2. Atualizar `PDVLayout.tsx` (menu de navegação)
3. Atualizar `Production.tsx` e componentes (verificações de permissão)
4. Atualizar `cardapioweb-webhook` (baixa automática)
5. Testar fluxo completo

