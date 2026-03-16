$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "src"

$fromPattern = "(?m)(^\s*\.from\(|\bsupabase\.from\(|\bdbClient\.from\(|^\s*\['from'\]\(|\bsupabase\['from'\]\(|\bdbClient\['from'\]\()"
$fromCount = (Get-ChildItem -Recurse -File $src | Select-String -Pattern $fromPattern).Count
$tablePattern = "(?m)(^\s*\.table\(|\bsupabase\.table\(|\bdbClient\.table\()"
$tableCount = (Get-ChildItem -Recurse -File $src | Select-String -Pattern $tablePattern).Count
$storageCount = (Get-ChildItem -Recurse -File $src | Select-String -Pattern "supabase\.storage").Count
$rpcCount = (Get-ChildItem -Recurse -File $src | Select-String -Pattern "(\.rpc\(|\['rpc'\]\()").Count
$channelCount = (Get-ChildItem -Recurse -File $src | Select-String -Pattern "\.channel\(").Count

Write-Output "Supabase usage audit"
Write-Output "from_calls=$fromCount"
Write-Output "table_calls=$tableCount"
Write-Output "storage_calls=$storageCount"
Write-Output "rpc_calls=$rpcCount"
Write-Output "channel_calls=$channelCount"

$pattern = "(?m)(^\s*\.from\(|\bsupabase\.from\(|\bdbClient\.from\(|^\s*\['from'\]\(|\bsupabase\['from'\]\(|\bdbClient\['from'\]\(|^\s*\.table\(|\bsupabase\.table\(|\bdbClient\.table\()'([^']+)'"
$tables = @{}
Get-ChildItem -Recurse -File $src | ForEach-Object {
  $content = Get-Content $_.FullName -Raw
  [regex]::Matches($content, $pattern) | ForEach-Object {
    $name = $_.Groups[2].Value
    if (-not $tables.ContainsKey($name)) {
      $tables[$name] = 0
    }
    $tables[$name]++
  }
}

Write-Output ""
Write-Output "Tables referenced via supabase.from:"
$tables.GetEnumerator() | Sort-Object Name | ForEach-Object {
  Write-Output ("{0},{1}" -f $_.Key, $_.Value)
}
