param([string]$TutorDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) '..\tesis-pc'))
$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $frontendRoot '.runtime'
$tutorRoot = (Resolve-Path -LiteralPath $TutorDirectory).Path
$python = Join-Path $tutorRoot '.venv\Scripts\python.exe'
$gateway = Join-Path $frontendRoot 'server\study_gateway.py'
$tunnel = Join-Path $runtimeDir 'cloudflared.exe'
$stateFile = Join-Path $runtimeDir 'pilot-processes.json'
if (Test-Path -LiteralPath $stateFile) {
    $prior = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    foreach ($saved in @($prior.gateway, $prior.tunnel)) {
        $running = Get-Process -Id $saved.id -ErrorAction SilentlyContinue
        if ($running -and $running.Path -eq $saved.path) { throw 'Hay procesos del piloto anterior activos. Usa scripts/stop-pilot.ps1 antes de reiniciar.' }
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $frontendRoot 'dist\index.html'))) { throw 'Primero ejecuta pnpm build.' }
if (-not (Test-Path -LiteralPath $python)) { throw 'Falta el entorno Python de tesis-pc.' }
if (Get-NetTCPConnection -LocalPort 8010 -State Listen -ErrorAction SilentlyContinue) { throw 'El puerto 8010 está ocupado. No se iniciará un segundo servidor.' }
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
if (-not (Test-Path -LiteralPath $tunnel)) {
    Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/download/2026.9.1/cloudflared-windows-amd64.exe' -OutFile $tunnel
}
if ((Get-FileHash -LiteralPath $tunnel -Algorithm SHA256).Hash -ne '2837888cc0f5d58f15b6dc478376de90b4d3ba5241c7947455d1e0a0df429712') { throw 'El archivo del túnel no coincide con el hash oficial fijado.' }
& (Join-Path $tutorRoot 'scripts\start_local_gpu.ps1')
$env:PYTHONUTF8 = '1'
$gatewayProcess = Start-Process -FilePath $python -ArgumentList @(('"' + $gateway + '"'), '--tutor-dir', ('"' + $tutorRoot + '"')) -WorkingDirectory $tutorRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'gateway.stdout.log') -RedirectStandardError (Join-Path $runtimeDir 'gateway.stderr.log')
$pilotState = @{ gateway = @{id=$gatewayProcess.Id; path=$python; started=$gatewayProcess.StartTime.ToUniversalTime().ToString('o')}; tunnel = @{id=0;path=$tunnel;started=''} }
$pilotState | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $stateFile -Encoding utf8
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    if ($gatewayProcess.HasExited) { throw 'El portal no pudo arrancar. Revisa .runtime/gateway.stderr.log.' }
    try { $response = Invoke-WebRequest 'http://127.0.0.1:8010/?tutor=1' -TimeoutSec 2; if ($response.StatusCode -eq 200) { $ready=$true; break } } catch { }
    Start-Sleep -Milliseconds 500
}
if (-not $ready) { throw 'El portal tarda en iniciar. Revisa .runtime/gateway.stderr.log antes de iniciar otro proceso.' }
$tunnelLog = Join-Path $runtimeDir 'tunnel.stderr.log'
$tunnelProcess = Start-Process -FilePath $tunnel -ArgumentList @('tunnel','--url','http://127.0.0.1:8010','--no-autoupdate') -WorkingDirectory $frontendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'tunnel.stdout.log') -RedirectStandardError $tunnelLog
$pilotState.tunnel = @{id=$tunnelProcess.Id;path=$tunnel;started=$tunnelProcess.StartTime.ToUniversalTime().ToString('o')}
$pilotState | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $stateFile -Encoding utf8
for ($i = 0; $i -lt 60; $i++) {
    if ($tunnelProcess.HasExited) { throw 'El túnel no pudo arrancar. Revisa .runtime/tunnel.stderr.log.' }
    $logText = Get-Content -LiteralPath $tunnelLog -Raw -ErrorAction SilentlyContinue
    if ($logText -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
        $publicUrl = $Matches[0] + '/?tutor=1'
        $publicUrl | Set-Content -LiteralPath (Join-Path $runtimeDir 'pilot-url.txt') -Encoding utf8
        Write-Output ('Enlace para alumnos: ' + $publicUrl)
        Write-Output ('Código del investigador: archivo local ' + (Join-Path $runtimeDir 'teacher-access.txt'))
        Write-Output 'Mantén este equipo encendido. Para cerrar el acceso público: scripts/stop-pilot.ps1.'
        return
    }
    Start-Sleep -Milliseconds 500
}
throw 'No se obtuvo el enlace temporal. Revisa .runtime/tunnel.stderr.log.'
