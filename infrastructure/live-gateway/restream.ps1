# Lanzado por MediaMTX cuando llega señal a /live o /radio.
#   -Target live  -> Kick + TikTok a la vez (H.264 + AAC por RTMP/RTMPS)
#   -Target radio -> Zeno.fm (MP3 por Icecast)
param([ValidateSet("live", "radio")][string]$Target = "live")

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$envFile = Join-Path $PSScriptRoot "gateway.env"
if (-not (Test-Path $envFile)) { Write-Error "Falta gateway.env (copia gateway.env.example)"; exit 1 }
$cfg = @{}
foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)\s*$') { $cfg[$Matches[1]] = $Matches[2].Trim() }
}

$source = "rtsp://127.0.0.1:8554/$Target"

if ($Target -eq "live") {
    $outputs = @()
    if ($cfg.KICK_KEY) { $outputs += "[f=flv:onfail=ignore]$($cfg.KICK_URL.TrimEnd('/'))/$($cfg.KICK_KEY)" }
    if ($cfg.TIKTOK_KEY) { $outputs += "[f=flv:onfail=ignore]$($cfg.TIKTOK_URL.TrimEnd('/'))/$($cfg.TIKTOK_KEY)" }
    if ($outputs.Count -eq 0) { Write-Error "No hay destinos: completa KICK_KEY y/o TIKTOK_KEY en gateway.env"; exit 1 }
    $bitrate = if ($cfg.VIDEO_BITRATE) { $cfg.VIDEO_BITRATE } else { "4500k" }
    $fps = if ($cfg.VIDEO_FPS) { $cfg.VIDEO_FPS } else { "30" }
    $bufsize = "{0}k" -f ([int]($bitrate -replace '[^0-9]', '') * 2)
    & ffmpeg -hide_banner -loglevel warning -rtsp_transport tcp -i $source `
        -map 0:v:0 -map 0:a:0? `
        -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p -r $fps -g ([int]$fps * 2) `
        -b:v $bitrate -maxrate $bitrate -bufsize $bufsize `
        -c:a aac -b:a 160k -ar 48000 -ac 2 `
        -f tee ($outputs -join "|")
} else {
    if (-not $cfg.ZENO_MOUNT -or -not $cfg.ZENO_PASSWORD) { Write-Error "Completa ZENO_MOUNT y ZENO_PASSWORD en gateway.env"; exit 1 }
    $bitrate = if ($cfg.RADIO_BITRATE) { $cfg.RADIO_BITRATE } else { "128k" }
    $port = if ($cfg.ZENO_PORT) { $cfg.ZENO_PORT } else { "80" }
    $target = "icecast://source:$($cfg.ZENO_PASSWORD)@$($cfg.ZENO_HOST):$port/$($cfg.ZENO_MOUNT.TrimStart('/'))"
    & ffmpeg -hide_banner -loglevel warning -rtsp_transport tcp -i $source -vn `
        -c:a libmp3lame -b:a $bitrate -ar 44100 -ac 2 `
        -content_type audio/mpeg -ice_name "Nexus Radio" -f mp3 $target
}
exit $LASTEXITCODE
