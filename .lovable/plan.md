
# Plano: Corrigir Erro 422 no Cadastro de Usuário

## Diagnóstico

O erro HTTP 422 (Unprocessable Content) no endpoint `/signup` do Supabase Auth indica que a **política de senha** configurada no projeto exige senhas mais fortes.

Baseado na pesquisa, o Supabase pode retornar:
```json
{
  "code": 422,
  "msg": "Password should contain at least one character of each...",
  "weak_password": { "reasons": ["characters"] }
}
```

## Problema Atual

1. **Validação frontend inadequada**: O Zod valida apenas `min(6)` caracteres
2. **Tratamento de erro genérico**: Só verifica "already registered", outras mensagens são exibidas em inglês
3. **UX ruim**: Usuário não sabe antecipadamente os requisitos da senha

---

## Solução Proposta

### 1. Atualizar Validação de Senha (Zod Schema)

Adicionar validação que reflita os requisitos do Supabase:

```typescript
const passwordSchema = z.string()
  .min(6, 'Senha deve ter pelo menos 6 caracteres')
  .regex(/[a-z]/, 'Senha deve conter letra minúscula')
  .regex(/[A-Z]/, 'Senha deve conter letra maiúscula')  
  .regex(/[0-9]/, 'Senha deve conter número')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Senha deve conter caractere especial');
```

### 2. Melhorar Tratamento de Erros

Traduzir mensagens comuns do Supabase Auth:

```typescript
const getSignupErrorMessage = (error: Error): string => {
  const msg = error.message.toLowerCase();
  
  if (msg.includes('already registered')) {
    return 'Este email já está cadastrado';
  }
  if (msg.includes('weak_password') || msg.includes('password should contain')) {
    return 'Senha muito fraca. Use letras maiúsculas, minúsculas, números e caracteres especiais';
  }
  if (msg.includes('invalid email')) {
    return 'Email inválido';
  }
  if (msg.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos';
  }
  
  return 'Erro ao criar conta. Tente novamente';
};
```

### 3. Adicionar Indicador Visual de Requisitos

Mostrar checklist de requisitos enquanto usuário digita:

- Mínimo 6 caracteres
- Letra minúscula (a-z)
- Letra maiúscula (A-Z)
- Número (0-9)
- Caractere especial (!@#$...)

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/Auth.tsx` | Atualizar schema Zod, adicionar tratamento de erros e indicador de requisitos |

---

## Alternativa Simples

Se não quiser forçar senhas complexas, outra opção é **desativar a política de senha forte** nas configurações de Auth do Lovable Cloud:

1. Abrir Cloud Dashboard
2. Ir em Auth Settings
3. Desativar "Strong Password Policy"

Isso permitiria senhas simples de 6+ caracteres.

---

## Recomendação

Implementar a **validação frontend completa** (opção 1-3) porque:
- Melhora a segurança do sistema
- Dá feedback instantâneo ao usuário
- Evita erros 422 sendo mostrados no console
- Mensagens em português

