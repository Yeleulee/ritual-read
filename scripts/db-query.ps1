# Runs SQL against the linked Supabase project via the Management API.
# Usage: .\scripts\db-query.ps1 "select 1"   or   .\scripts\db-query.ps1 -File path\to.sql
param(
  [Parameter(Position = 0)] [string] $Query,
  [string] $File,
  [string] $ProjectRef = "liqdfaxmmqpovjptmaxe"
)
$ErrorActionPreference = "Stop"
if ($File) { $Query = Get-Content $File -Raw }
if (-not $Query) { throw "Provide a SQL string or -File." }

$tokenPath = Join-Path $env:USERPROFILE ".supabase\access-token"
if (-not (Test-Path $tokenPath)) { throw "Not logged in. Run: npx supabase login" }
$token = (Get-Content $tokenPath -Raw).Trim()

$body = @{ query = $Query } | ConvertTo-Json -Depth 5
try {
  Invoke-RestMethod -Method Post `
    -Uri "https://api.supabase.com/v1/projects/$ProjectRef/database/query" `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json" -Body $body
} catch {
  $resp = $_.ErrorDetails.Message
  if ($resp) { Write-Error $resp } else { throw }
}
