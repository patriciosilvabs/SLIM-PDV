

# Nova aba "TAMANHOS" no Cardapio

## Objetivo
Criar uma nova aba "TAMANHOS" na pagina de Cardapio (Menu), posicionada entre "PRODUTOS" e "COMPLEMENTOS". Essa aba centralizara a configuracao do modal de selecao de sabores (1 sabor, 2 sabores, etc.) que hoje esta escondida dentro das configuracoes avancadas do grupo de complemento.

## O que muda para o gestor
Hoje, para configurar as opcoes de sabores (textos, descricoes, canais, ativar/desativar), o gestor precisa entrar no grupo de complemento, abrir configuracoes avancadas e encontrar a secao "Modal de selecao de sabores". Com a nova aba, essa configuracao fica visivel e acessivel diretamente na tela principal do Cardapio.

## Mudancas Tecnicas

### 1. Adicionar aba "TAMANHOS" no Menu.tsx
**Arquivo:** `src/pages/Menu.tsx`

- Adicionar `<TabsTrigger value="sizes">TAMANHOS</TabsTrigger>` entre PRODUTOS e COMPLEMENTOS
- Criar `<TabsContent value="sizes">` com a listagem de todos os grupos de complemento que tem `applies_per_unit = true`
- Cada grupo sera exibido como um card editavel com:
  - Nome do grupo
  - Toggle ativar/desativar modal
  - Canais onde o modal aparece (badges clicaveis: Delivery, Balcao, Mesa)
  - Lista editavel de opcoes de sabores (quantidade, titulo, descricao)
  - Botao para adicionar mais opcoes de sabor
- Ao salvar, chamar `updateGroup` com os campos `flavor_modal_enabled`, `flavor_modal_channels` e `flavor_options`

### 2. Filtrar grupos aplicaveis
- Usar os dados ja carregados de `complementGroups` (hook `useComplementGroups`)
- Filtrar apenas os que tem `applies_per_unit === true`
- Se nenhum grupo tiver essa config, exibir mensagem orientando o gestor a ativar "Aplica por unidade" em um grupo de complemento

### 3. Layout da aba
- Card principal com titulo "Tamanhos" e descricao "Configure as opcoes de tamanho/sabores que aparecem para o cliente"
- Para cada grupo com `applies_per_unit`, exibir:
  - Secao com nome do grupo (ex: "Sabores Pizza Grande")
  - Toggle do modal + canais
  - Tabela editavel das opcoes (mesma UI que ja existe no ComplementGroupDialog, linhas 700-811)
  - Botao "Salvar" individual por grupo

### 4. Sem mudancas no banco de dados
- Todos os campos necessarios (`flavor_modal_enabled`, `flavor_modal_channels`, `flavor_options`) ja existem na tabela `complement_groups`
- A aba apenas oferece uma interface mais acessivel para editar esses campos

### Ordem de implementacao
1. Adicionar a TabsTrigger e TabsContent no Menu.tsx
2. Criar o conteudo da aba com listagem dos grupos `applies_per_unit`
3. Implementar edicao inline dos campos de configuracao do modal de sabores
4. Conectar com `updateGroup` para salvar alteracoes
