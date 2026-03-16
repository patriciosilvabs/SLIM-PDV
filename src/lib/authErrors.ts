export function getSignupErrorMessage(error: Error): string {
  const msg = error.message.toLowerCase();

  if (
    msg.includes('already registered') ||
    msg.includes('user already registered') ||
    msg.includes('email-already-in-use') ||
    msg.includes('email already in use') ||
    msg.includes('email_exists')
  ) {
    return 'Este email ja esta cadastrado. Use a aba Entrar.';
  }
  if (
    msg.includes('weak_password') ||
    msg.includes('password should contain') ||
    msg.includes('password is too weak') ||
    msg.includes('weak-password')
  ) {
    return 'Senha muito fraca. Use letras maiusculas, minusculas, numeros e caracteres especiais.';
  }
  if (msg.includes('invalid email') || msg.includes('invalid-email')) {
    return 'Email invalido.';
  }
  if (msg.includes('operation not allowed')) {
    return 'Cadastro por email e senha nao esta habilitado neste projeto.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('too-many-requests')) {
    return 'Muitas tentativas. Aguarde alguns minutos.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Email nao confirmado. Verifique sua caixa de entrada.';
  }

  return `Erro ao criar conta: ${error.message}`;
}

export function getLoginErrorMessage(error: Error): string {
  const msg = error.message.toLowerCase();

  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid_credentials') ||
    msg.includes('invalid-credential') ||
    msg.includes('wrong-password') ||
    msg.includes('user-not-found')
  ) {
    return 'Email ou senha incorretos.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Email nao confirmado. Verifique sua caixa de entrada.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('too-many-requests')) {
    return 'Muitas tentativas. Aguarde alguns minutos.';
  }
  if (msg.includes('user not found')) {
    return 'Usuario nao encontrado.';
  }

  return error.message;
}
