

# Novo Sistema de Autenticacao KDS por Codigos

## Resumo
Substituir o login por usuario/senha por um sistema de dois codigos gerados automaticamente ao cadastrar um dispositivo:
- **Codigo Verificador** (6 digitos): vincula o dispositivo a conta do cliente (tenant)
- **Codigo de Autenticacao** (6 digitos): faz o login do dispositivo para uso

## Fluxo do Usuario

### Administrador (Configuracoes)
1. Clica em "Novo Dispositivo"
2. Preenche nome e praca (estacao)
3. Sistema gera automaticamente os dois codigos
4. Tela exibe os codigos para o admin anotar/compartilhar
5. Admin pode regenerar codigos a qualquer momento

### Operador (Tablet/KDS)
1. Acessa `/kds`
2. Digita o **Codigo Verificador** (6 digitos) - vincula ao tenant
3. Digita o **Codigo de Autenticacao** (6 digitos) - faz login
4. Dispositivo autenticado, exibe a linha de producao

## Mudancas Tecnicas

### 1. Migracao do Banco de Dados
- Adicionar colunas `verification_code` (text) e `auth_code` (text) na tabela `kds_devices`
- Criar indice unico em `(verification_code)` globalmente (para lookup sem tenant)
- Remover obrigatoriedade de `username` e `password_hash` (manter para compatibilidade)

### 2. Edge Function (`supabase/functions/kds-device-auth/index.ts`)
- Nova action `register`: gera 2 codigos aleatorios de 6 digitos ao criar dispositivo
- Nova action `login_by_codes`: recebe os dois codigos, valida e retorna o dispositivo
- Nova action `regenerate_codes`: gera novos codigos para um dispositivo existente
- Remover logica de hash de senha (simplificar)

### 3. Tela de Login KDS (`src/components/kds/KdsDeviceLogin.tsx`)
- Substituir campos usuario/senha por dois inputs de 6 digitos
- Usar componente `InputOTP` (ja instalado) para entrada dos codigos
- Primeiro campo: "Codigo Verificador"
- Segundo campo: "Codigo de Autenticacao"
- Manter botao "Voltar para Home"

### 4. Configuracoes de Dispositivos (`src/components/settings/KdsDevicesSettings.tsx`)
- Dialog de criacao: remover campos usuario/senha, manter nome e praca
- Apos criar, exibir dialog com os dois codigos gerados (com opcao de copiar)
- Na lista de dispositivos: mostrar botao para ver/regenerar codigos
- Remover funcionalidade de "Redefinir Senha", substituir por "Regenerar Codigos"

### 5. Tela de Auth (`src/pages/Auth.tsx`)
- Manter o botao "Acessar KDS" ja adicionado (sem mudancas)

## Formato dos Codigos
- **Codigo Verificador**: 6 digitos numericos (ex: 482715)
- **Codigo de Autenticacao**: 6 digitos numericos (ex: 936042)
- Gerados aleatoriamente no servidor (edge function)
- Verificador e unico globalmente para permitir lookup sem informar tenant

