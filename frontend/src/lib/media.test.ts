import { describe, expect, it } from 'vitest'
import { imageSource, proxiedImage } from './media'

describe('imageSource', () => {
  it('loads our Supabase storage images directly and proxies third parties', () => {
    expect(imageSource('https://abc.supabase.co/storage/v1/object/public/media/x.png')).toEqual({ src: 'https://abc.supabase.co/storage/v1/object/public/media/x.png', direct: true })
    expect(imageSource('https://cdn.otro.com/a.jpg')).toEqual({ src: proxiedImage('https://cdn.otro.com/a.jpg'), direct: false })
    expect(imageSource('https://abc.supabase.co/auth/v1/x')?.direct).toBe(false)
    expect(imageSource('/icons/icon-192.png')).toEqual({ src: '/icons/icon-192.png', direct: true })
    expect(imageSource(null)).toBeNull()
  })
})
