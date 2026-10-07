param([string]$TutorDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) '..\tesis-pc'))
$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
$tutorRoot = (Resolve-Path -LiteralPath $TutorDirectory).Path
if (-not (Test-Path -LiteralPath (Join-Path $frontendRoot 'dist\index.html'))) {
    throw 'Primero ejecuta pnpm build dentro de cf-app.'
}
$python = Join-Path $tutorRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'No se encontró el entorno Python de tesis-pc. Ejecuta uv sync --locked allí.' }
$gateway = Join-Path $frontendRoot 'server\study_gateway.py'
& $python $gateway --tutor-dir $tutorRoot
exit $LASTEXITCODE
