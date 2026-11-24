// Detección pura de fuentes de transmisión para el Escenario del portal.
// Recibe la URL tal cual la pega el editor en "Portada" y decide CÓMO
// reproducirla (iframe del proveedor, <video> nativo/HLS, <audio>). Solo
// acepta http(s): cualquier otro esquema (javascript:, data:, etc.)
// devuelve null y el portal vuelve al escenario de noticias.

export type VideoSource =
  | { kind: 'youtube'; embedUrl: string }
  | { kind: 'twitch'; channel: string | null; video: string | null }
  | { kind: 'facebook'; embedUrl: string }
  | { kind: 'kick'; channel: string; embedUrl: string }
  | { kind: 'hls'; url: string }
  | { kind: 'file'; url: string }

export type AudioSource = { kind: 'hls' | 'native'; url: string }

const YT_ID = /^[A-Za-z0-9_-]{11}$/
const VIDEO_FILE = /\.(mp4|webm|ogv|mov|m4v)$/i

export function parseHttpUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

function host(url: URL): string {
  return url.hostname.toLowerCase().replace(/^(www|m|web|music)\./, '')
}

export function isHlsUrl(raw: string): boolean {
  const url = parseHttpUrl(raw)
  return Boolean(url && url.pathname.toLowerCase().endsWith('.m3u8'))
}

const YT_PARAMS = 'autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1'

function youtube(url: URL): VideoSource | null {
  const h = host(url)
  const parts = url.pathname.split('/').filter(Boolean)
  let id: string | null = null
  if (h === 'youtu.be') id = parts[0] ?? null
  else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
    if (parts[0] === 'watch') id = url.searchParams.get('v')
    else if (['live', 'embed', 'shorts', 'v'].includes(parts[0] ?? '') && parts[1] && parts[1] !== 'live_stream') id = parts[1]
    else {
      // Canal en vivo: /channel/UCxxxx/live o /embed/live_stream?channel=UCxxxx
      const channel = parts[0] === 'channel' && parts[2] === 'live'
        ? parts[1]
        : parts[0] === 'embed' && parts[1] === 'live_stream' ? url.searchParams.get('channel') : null
      if (channel && /^[A-Za-z0-9_-]{10,40}$/.test(channel)) {
        return { kind: 'youtube', embedUrl: `https://www.youtube.com/embed/live_stream?channel=${channel}&${YT_PARAMS}` }
      }
      return null
    }
  } else return null
  if (!id || !YT_ID.test(id)) return null
  return { kind: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}?${YT_PARAMS}` }
}

function twitch(url: URL): VideoSource | null {
  const h = host(url)
  if (h === 'player.twitch.tv') {
    const channel = url.searchParams.get('channel')
    const video = url.searchParams.get('video')
    if (channel || video) return { kind: 'twitch', channel, video }
    return null
  }
  if (h !== 'twitch.tv') return null
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0] === 'videos' && parts[1] && /^\d+$/.test(parts[1])) return { kind: 'twitch', channel: null, video: parts[1] }
  if (parts.length === 1 && /^[A-Za-z0-9_]{3,25}$/.test(parts[0])) return { kind: 'twitch', channel: parts[0].toLowerCase(), video: null }
  return null
}

function facebook(url: URL): VideoSource | null {
  const h = host(url)
  if (h === 'fb.watch') {
    return { kind: 'facebook', embedUrl: fbEmbed(url.toString()) }
  }
  if (h !== 'facebook.com') return null
  if (url.pathname.startsWith('/plugins/video.php')) {
    const href = parseHttpUrl(url.searchParams.get('href'))
    return href ? { kind: 'facebook', embedUrl: fbEmbed(href.toString()) } : null
  }
  if (/\/videos\/|^\/watch|\/live/.test(url.pathname)) return { kind: 'facebook', embedUrl: fbEmbed(url.toString()) }
  return null
}

// Rutas de kick.com que no son canales.
const KICK_RESERVED = new Set(['video', 'videos', 'categories', 'category', 'browse', 'search', 'following', 'clips', 'dashboard', 'settings', 'privacy', 'terms', 'about', 'support', 'login', 'signup'])

function kick(url: URL): VideoSource | null {
  const h = host(url)
  if (h !== 'kick.com' && h !== 'player.kick.com') return null
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length !== 1) return null
  const channel = parts[0].toLowerCase()
  if (!/^[a-z0-9_-]{2,25}$/.test(channel) || (h === 'kick.com' && KICK_RESERVED.has(channel))) return null
  return { kind: 'kick', channel, embedUrl: `https://player.kick.com/${channel}?muted=true&autoplay=true` }
}

function fbEmbed(href: string): string {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false&autoplay=true&mute=1`
}

export function detectVideoSource(raw: unknown): VideoSource | null {
  const url = parseHttpUrl(raw)
  if (!url) return null
  const found = youtube(url) ?? twitch(url) ?? facebook(url) ?? kick(url)
  if (found) return found
  const path = url.pathname.toLowerCase()
  if (path.endsWith('.m3u8')) return { kind: 'hls', url: url.toString() }
  if (VIDEO_FILE.test(path)) return { kind: 'file', url: url.toString() }
  return null
}

/** Twitch exige el dominio que embebe (`parent`) -- se resuelve en runtime. */
export function twitchEmbedUrl(src: Extract<VideoSource, { kind: 'twitch' }>, parentHost: string): string {
  const params = new URLSearchParams()
  if (src.video) params.set('video', src.video)
  else if (src.channel) params.set('channel', src.channel)
  params.set('parent', parentHost || 'localhost')
  params.set('muted', 'true')
  params.set('autoplay', 'true')
  return `https://player.twitch.tv/?${params.toString()}`
}

export function detectAudioSource(raw: unknown): AudioSource | null {
  const url = parseHttpUrl(raw)
  if (!url) return null
  return { kind: url.pathname.toLowerCase().endsWith('.m3u8') ? 'hls' : 'native', url: url.toString() }
}
