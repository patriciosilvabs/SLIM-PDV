

# Plano: Resolver Erro de Slug Duplicado na Versão Publicada

## Diagnóstico

O erro 409 (Conflict) está acontecendo porque:

| Ambiente | Status do Código |
|----------|-----------------|
| **Preview** (id-preview--51a2614a...) | ✅ Código corrigido |
| **Publicado** (cardapio-offline-pos.lovable.app) | ❌ Código antigo |

O usuário está testando na **versão publicada**, que ainda não tem as correções de verificação de slug.

### Evidência

O arquivo de bundle `index-BuzD3JZ5.js` no erro indica que é um build diferente do preview, confirmando que as correções não foram publicadas.

## Solução

**Publicar a aplicação** para que as correções sejam aplicadas na versão de produção.

As correções já implementadas no código incluem:
1. Verificação automática do slug quando gerado a partir do nome
2. Botão desabilitado até confirmação de disponibilidade
3. Re-verificação final antes de criar o tenant (previne race conditions)
4. Mensagens de erro mais claras

## Ação Necessária

Clicar no botão "Publicar" para aplicar as correções na versão de produção.

