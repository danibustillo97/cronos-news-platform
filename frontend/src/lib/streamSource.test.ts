import { describe, expect, it } from 'vitest'
import { detectAudioSource, detectVideoSource, isHlsUrl, twitchEmbedUrl } from './streamSource'

describe('detectVideoSource', () => {
  it('detects every YouTube URL shape', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtube.com/live/dQw4w9WgXcQ?feature=share',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      const src = detectVideoSource(url)
      expect(src?.kind).toBe('youtube')
      expect(src && 'embedUrl' in src && src.embedUrl).toContain('/embed/dQw4w9WgXcQ?')
    }
  })

  it('supports a YouTube channel live stream', () => {
    const src = detectVideoSource('https://www.youtube.com/channel/UC4R8DWoMoI7CAwX8_LjQHig/live')
    expect(src).toEqual({ kind: 'youtube', embedUrl: expect.stringContaining('live_stream?channel=UC4R8DWoMoI7CAwX8_LjQHig') })
  })

  it('rejects malformed YouTube ids', () => {
    expect(detectVideoSource('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(detectVideoSource('https://www.youtube.com/@canal')).toBeNull()
  })

  it('detects Twitch channels and VODs and builds the parent-aware embed', () => {
    const channel = detectVideoSource('https://www.twitch.tv/NexusNews')
    expect(channel).toEqual({ kind: 'twitch', channel: 'nexusnews', video: null })
    expect(detectVideoSource('https://twitch.tv/videos/123456')).toEqual({ kind: 'twitch', channel: null, video: '123456' })
    if (channel?.kind !== 'twitch') throw new Error('expected twitch')
    const embed = twitchEmbedUrl(channel, 'nexusnews.info')
    expect(embed).toContain('channel=nexusnews')
    expect(embed).toContain('parent=nexusnews.info')
  })

  it('wraps Facebook videos in the official plugin', () => {
    const src = detectVideoSource('https://www.facebook.com/nexus/videos/1234567890/')
    expect(src?.kind).toBe('facebook')
    expect(src && 'embedUrl' in src && src.embedUrl).toMatch(/^https:\/\/www\.facebook\.com\/plugins\/video\.php\?href=https%3A%2F%2Fwww\.facebook\.com%2Fnexus%2Fvideos/)
    expect(detectVideoSource('https://fb.watch/abc123/')?.kind).toBe('facebook')
  })

  it('detects Kick channel and player URLs', () => {
    const expected = { kind: 'kick', channel: 'nexusnews', embedUrl: 'https://player.kick.com/nexusnews?muted=true&autoplay=true' }
    expect(detectVideoSource('https://kick.com/NexusNews')).toEqual(expected)
    expect(detectVideoSource('https://www.kick.com/nexusnews?ref=x')).toEqual(expected)
    expect(detectVideoSource('https://player.kick.com/nexusnews')).toEqual(expected)
    expect(detectVideoSource('https://kick.com/categories')).toBeNull()
    expect(detectVideoSource('https://kick.com/nexusnews/videos/abc')).toBeNull()
    expect(detectVideoSource('https://kick.com/')).toBeNull()
  })

  it('detects HLS and direct files, ignoring query strings', () => {
    expect(detectVideoSource('https://cdn.example.com/live/master.m3u8?token=1')).toEqual({ kind: 'hls', url: 'https://cdn.example.com/live/master.m3u8?token=1' })
    expect(detectVideoSource('https://cdn.example.com/clip.MP4')?.kind).toBe('file')
    expect(isHlsUrl('https://x.com/a.m3u8?x=1')).toBe(true)
    expect(isHlsUrl('https://x.com/a.mp3')).toBe(false)
  })

  it('never accepts non-http schemes or garbage', () => {
    expect(detectVideoSource('javascript:alert(1)')).toBeNull()
    expect(detectVideoSource('data:video/mp4;base64,AAAA')).toBeNull()
    expect(detectVideoSource('no es una url')).toBeNull()
    expect(detectVideoSource(42)).toBeNull()
    expect(detectVideoSource('https://example.com/pagina')).toBeNull()
  })
})

describe('detectAudioSource', () => {
  it('chooses HLS for .m3u8 and native for everything else', () => {
    expect(detectAudioSource('https://radio.example.com/live/playlist.m3u8')?.kind).toBe('hls')
    expect(detectAudioSource('https://stream.example.com:8000/radio.mp3')?.kind).toBe('native')
    expect(detectAudioSource('https://icecast.example.com/stream')?.kind).toBe('native')
    expect(detectAudioSource('ftp://x/y.mp3')).toBeNull()
    expect(detectAudioSource('')).toBeNull()
  })
})
