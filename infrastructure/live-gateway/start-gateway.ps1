# Enciende el puente local de NEXUS (MediaMTX). Ejecutar:
#   powershell -ExecutionPolicy Bypass -File infrastructure\live-gateway\start-gateway.ps1
# La primera vez descarga MediaMTX v1.9.3 (oficial, GitHub) en esta carpeta.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$version = "v1.9.3"
$exe = Join-Path $PSScriptRoot "mediamtx.exe"

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "Falta ffmpeg. Instálalo con:  winget install Gyan.FFmpeg   y vuelve a abrir la terminal." -ForegroundColor Yellow
    exit 1
}
if (-not (Test-Path (Join-Path $PSScriptRoot "gateway.env"))) {
    Copy-Item (Join-Path $PSScriptRoot "gateway.env.example") (Join-Path $PSScriptRoot "gateway.env")
    Write-Host "Creé gateway.env: complétalo con tus claves de Kick, TikTok y Zeno.fm y vuelve a ejecutar." -ForegroundColor Yellow
    exit 1
}
if (-not (Test-Path $exe)) {
    $zip = Join-Path $env:TEMP "mediamtx_$version.zip"
    $url = "https://github.com/bluenviron/mediamtx/releases/download/$version/mediamtx_${version}_windows_amd64.zip"
    Write-Host "Descargando MediaMTX $version..."
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath (Join-Path $env:TEMP "mediamtx_$version") -Force
    Copy-Item (Join-Path $env:TEMP "mediamtx_$version\mediamtx.exe") $exe
}

Write-Host ""
Write-Host "Puente NEXUS encendido. No cierres esta ventana mientras transmitas." -ForegroundColor Green
Write-Host "  Video (Broadcaster):  http://localhost:8889/live/whip   -> Kick + TikTok"
Write-Host "  Radio (Estación):     http://localhost:8889/radio/whip  -> Zeno.fm"
Write-Host ""
& $exe (Join-Path $PSScriptRoot "mediamtx.yml")
