
# Adicionar acesso ao login KDS a partir da tela principal

## Problema
A tela de login principal (`/auth`) exige email e senha, mas dispositivos KDS usam credenciais simples (usuario/senha). Nao ha link visivel para acessar o login do KDS.

## Solucao
Adicionar um botao/link na tela de login principal que redireciona para `/kds`, onde o login por usuario KDS esta disponivel.

## Mudancas

### 1. Tela de Login (`src/pages/Auth.tsx`)
- Adicionar um botao "Entrar como Dispositivo KDS" abaixo da secao de login existente
- O botao usara o icone `Tablet` e navegara para `/kds`
- Ficara posicionado apos o separador "OU CONTINUE COM", similar ao botao do Google na imagem de referencia

### Detalhes Tecnicos
- Usar `useNavigate` do react-router-dom para redirecionar para `/kds`
- Estilizar como botao `variant="outline"` para diferenciar do login principal
- Adicionar texto descritivo como "Acessar KDS (tablets e monitores)"
