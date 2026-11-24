'use client'

// Adjunta una fuente a un <video>/<audio>. HLS (.m3u8): nativo cuando el
// navegador lo soporta (Safari/iOS), si no hls.js cargado bajo demanda --
// nunca entra al bundle inicial del home. Devuelve la función de limpieza.

import { isHlsUrl } from '@/lib/streamSource'

export async function attachMediaSource(
  media: HTMLMediaElement,
  url: string,
  onFatal?: (message: string) => void,
): Promise<() => void> {
  const reset = () => {
    media.removeAttribute('src')
    try { media.load() } catch { /* jsdom / elemento desmontado */ }
  }

  if (!isHlsUrl(url) || media.canPlayType('application/vnd.apple.mpegurl')) {
    media.src = url
    return reset
  }

  const { default: Hls } = await import('hls.js')
  if (!Hls.isSupported()) {
    media.src = url
    return reset
  }
  const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 })
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) return
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
    else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
    else onFatal?.('No se pudo reproducir la transmisión.')
  })
  hls.loadSource(url)
  hls.attachMedia(media)
  return () => { hls.destroy(); reset() }
}
