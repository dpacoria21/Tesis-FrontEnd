$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
$stateFile = Join-Path $frontendRoot '.runtime\pilot-processes.json'
if (-not (Test-Path -LiteralPath $stateFile)) { Write-Output 'No hay procesos registrados por start-pilot.ps1.'; return }
$state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
foreach ($saved in @($state.tunnel, $state.gateway)) {
    if ($saved.id -le 0) { continue }
    $running = Get-Process -Id $saved.id -ErrorAction SilentlyContinue
    if (-not $running) { continue }
    if ($running.Path -ne $saved.path -or $running.StartTime.ToUniversalTime().Ticks -ne ([datetime]$saved.started).ToUniversalTime().Ticks) {
        throw 'El identificador pertenece a otro proceso. No se detendrá.'
    }
    Stop-Process -Id $saved.id
}
Write-Output 'Acceso público y portal detenidos. Los datos se conservan. El modelo local sigue disponible para tesis-pc.'
