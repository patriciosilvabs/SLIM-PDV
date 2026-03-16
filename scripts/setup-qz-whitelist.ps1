$projectRoot = Split-Path -Parent $PSScriptRoot
$certificatePath = Join-Path $projectRoot 'public\qz\digital-certificate.txt'
$qzInstallPath = 'C:\Program Files\QZ Tray'
$qzConsolePath = 'C:\Program Files\QZ Tray\qz-tray-console.exe'
$qzTrayPath = 'C:\Program Files\QZ Tray\qz-tray.exe'
$overridePath = Join-Path $qzInstallPath 'override.crt'
$allowedPath = Join-Path $env:APPDATA 'qz\allowed.dat'
$userQzPath = Join-Path $env:APPDATA 'qz'
$userOverridePath = Join-Path $userQzPath 'override.crt'

if (!(Test-Path $certificatePath)) {
  throw "Certificado QZ nao encontrado em $certificatePath"
}

if (!(Test-Path $qzInstallPath)) {
  throw "Diretorio do QZ Tray nao encontrado em $qzInstallPath"
}

if (!(Test-Path $qzConsolePath)) {
  throw "QZ Tray nao encontrado em $qzConsolePath"
}

if (!(Test-Path $qzTrayPath)) {
  throw "Executavel principal do QZ Tray nao encontrado em $qzTrayPath"
}

$previousWrite = if (Test-Path $allowedPath) {
  (Get-Item $allowedPath).LastWriteTimeUtc
} else {
  Get-Date '2000-01-01'
}

# Trust this self-signed CA as the local QZ trusted root.
Get-Process | Where-Object { $_.ProcessName -like 'qz-tray*' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

if (!(Test-Path $userQzPath)) {
  New-Item -ItemType Directory -Path $userQzPath -Force | Out-Null
}

Copy-Item $certificatePath $userOverridePath -Force
if (!(Test-Path $userOverridePath)) {
  throw "Falha ao instalar override.crt em $userOverridePath"
}

$sourceHash = (Get-FileHash $certificatePath -Algorithm SHA256).Hash
$userOverrideHash = (Get-FileHash $userOverridePath -Algorithm SHA256).Hash
if ($sourceHash -ne $userOverrideHash) {
  throw "override.crt em $userOverridePath foi copiado com hash divergente"
}

try {
  Copy-Item $certificatePath $overridePath -Force -ErrorAction Stop
} catch {
  Write-Host "Sem permissao para gravar em $overridePath, usando override por usuario."
}

$trustedRootPath = if (Test-Path $overridePath) { $overridePath } else { $userOverridePath }
$trustedRootArg = "-DtrustedRootCert=$trustedRootPath"
[Environment]::SetEnvironmentVariable('QZ_OPTS', $trustedRootArg, 'User')
$env:QZ_OPTS = $trustedRootArg

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeMethods {
  [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
  public static extern IntPtr SendMessageTimeout(
    IntPtr hWnd,
    uint Msg,
    IntPtr wParam,
    string lParam,
    uint fuFlags,
    uint uTimeout,
    out IntPtr lpdwResult
  );
}
"@

$HWND_BROADCAST = [IntPtr]0xffff
$WM_SETTINGCHANGE = 0x001A
$SMTO_ABORTIFHUNG = 0x0002
$result = [IntPtr]::Zero
[void][NativeMethods]::SendMessageTimeout(
  $HWND_BROADCAST,
  $WM_SETTINGCHANGE,
  [IntPtr]::Zero,
  'Environment',
  $SMTO_ABORTIFHUNG,
  5000,
  [ref]$result
)

$process = Start-Process -FilePath $qzConsolePath -ArgumentList @('--whitelist', $certificatePath) -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 4

if (!$process.HasExited) {
  Stop-Process -Id $process.Id -Force
}

$updatedWrite = if (Test-Path $allowedPath) {
  (Get-Item $allowedPath).LastWriteTimeUtc
} else {
  $null
}

if (!$updatedWrite -or $updatedWrite -le $previousWrite) {
  throw "O QZ Tray nao confirmou a atualizacao do whitelist em $allowedPath"
}

Start-Process -FilePath $qzTrayPath | Out-Null

Write-Host "Certificado QZ instalado em $trustedRootPath e registrado no whitelist com sucesso."
