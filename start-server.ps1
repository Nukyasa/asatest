$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*#" -or $_ -notmatch "=") { return }
    $name, $value = $_ -split "=", 2
    [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), "Process")
  }
}

if (-not $env:ADMIN_SESSION_SECRET) {
  $env:ADMIN_SESSION_SECRET = 'local-dev-admin-session-nurdin-adna'
}
& "C:\nvm4w\nodejs\node.exe" server.js
