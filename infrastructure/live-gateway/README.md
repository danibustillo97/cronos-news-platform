# Puente en vivo NEXUS (MediaMTX, gratis, en tu PC)

```
Broadcaster (video) ──WHIP──► puente ──RTMP──► Kick + TikTok (a la vez)
Estación de radio ───WHIP──► puente ──Icecast─► Zeno.fm ──► portal (modo radio)
```

## Una sola vez
1. Instala ffmpeg: `winget install Gyan.FFmpeg` (cierra y abre la terminal).
2. Ejecuta `powershell -ExecutionPolicy Bypass -File infrastructure\live-gateway\start-gateway.ps1`.
   Crea `gateway.env`: complétalo y vuelve a ejecutarlo (la primera vez descarga MediaMTX v1.9.3).
3. En `gateway.env`:
   - **Kick**: Creator Dashboard → Settings → Stream URL y Stream Key → `KICK_URL`, `KICK_KEY`.
   - **TikTok** (opcional): server URL y stream key de TikTok LIVE → `TIKTOK_URL`, `TIKTOK_KEY`. TikTok solo da clave RTMP a cuentas con acceso a LIVE.
   - **Zeno.fm**: crea la estación gratis → Broadcast settings → host, puerto, mount y password → `ZENO_*`.

## Cada transmisión
1. Enciende el puente (`start-gateway.ps1`) y deja la ventana abierta.
2. **Video**: Broadcaster → Estudio de video → Ajustes: el endpoint ya es `http://localhost:8889/live/whip`;
   escribe tu canal de Kick y deja marcado "Cambiar la portada…". Pulsa **Emitir**: sale a Kick y TikTok y la
   portada pasa a EN VIVO; al detener, vuelve a la noticia.
3. **Radio**: Broadcaster → Estación de radio → Ajustes: pega la URL pública de Zeno.fm (la de escucha).
   **Iniciar auto DJ** → **Salir al aire**. La portada pasa a la radio (si no hay video en vivo).

## Música
Solo libre de derechos o con licencia (Pixabay Music, YouTube Audio Library, propia). La música comercial hace que
Kick y TikTok silencien o corten la transmisión. Cada pista guarda de dónde viene su licencia.

## Notas
- El puente solo escucha en tu PC; las claves están en `gateway.env` (ignorado por git).
- Se re-codifica a H.264 + AAC (lo que exigen Kick y TikTok): usa CPU. Si se traba, baja `VIDEO_BITRATE` a `3000k`.
- La radio y el auto DJ suenan mientras el panel esté abierto en tu PC.
