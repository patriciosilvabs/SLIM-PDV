

# Plano: Corrigir Verificação de Slug Duplicado

## Problema Identificado

A criação de loja falha com erro 409 (duplicate key) porque:

1. **Slug auto-gerado não é verificado** - Quando o usuário digita o nome, o slug é gerado automaticamente mas `checkSlugAvailability()` não é chamada
2. **Validação aceita null** - A condição `if (!slugAvailable)` bloqueia corretamente `false`, mas o problema é que o estado começa como `null` e nunca muda para `true` quando auto-gerado
3. **Race condition** - Se o usuário clicar rápido em "Criar Loja" antes da verificação terminar, pode tentar criar com slug duplicado

## Correções Necessárias

### Arquivo: `src/pages/CreateStore.tsx`

| Correção | Descrição |
|----------|-----------|
| Verificar slug ao gerar | Chamar `checkSlugAvailability()` quando o slug é auto-gerado a partir do nome |
| Bloquear envio se null | Mudar validação para exigir `slugAvailable === true` explicitamente |
| Debounce na verificação | Adicionar debounce para evitar múltiplas chamadas à API |
| Re-verificar antes de enviar | Fazer verificação final no momento do submit |

### Mudanças Específicas

**1. Adicionar verificação ao gerar slug automaticamente:**
```typescript
const handleNameChange = (name: string) => {
  const generatedSlug = generateSlug(name);
  setFormData(prev => ({
    ...prev,
    name,
    slug: prev.slug || generatedSlug,
  }));
  
  // Verificar disponibilidade do slug gerado
  if (!formData.slug) {
    checkSlugAvailability(generatedSlug);
  }
};
```

**2. Validação mais rigorosa no submit:**
```typescript
// Antes
if (!slugAvailable) {
  setErrors(prev => ({ ...prev, slug: 'Este slug já está em uso' }));
  return;
}

// Depois
if (slugAvailable !== true) {
  setErrors(prev => ({ 
    ...prev, 
    slug: slugAvailable === false 
      ? 'Este slug já está em uso' 
      : 'Aguarde a verificação do slug'
  }));
  return;
}
```

**3. Adicionar verificação final antes de inserir:**
```typescript
// Re-verificar disponibilidade antes de criar
const { data: existingSlug } = await supabase
  .from('tenants')
  .select('id')
  .eq('slug', formData.slug)
  .maybeSingle();

if (existingSlug) {
  setSlugAvailable(false);
  setErrors(prev => ({ ...prev, slug: 'Este slug já está em uso' }));
  return;
}
```

**4. Desabilitar botão durante verificação:**
```typescript
<Button 
  type="submit" 
  disabled={isSubmitting || checkingSlug || slugAvailable !== true}
>
```

## Resultado Esperado

- O slug será verificado automaticamente assim que for gerado do nome
- O botão "Criar Loja" só ficará ativo quando o slug for confirmado como disponível
- Verificação dupla no momento do submit previne race conditions
- Mensagem de erro mais clara para o usuário

