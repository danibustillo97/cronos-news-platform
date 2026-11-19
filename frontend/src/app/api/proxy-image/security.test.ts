import { describe, expect, it } from 'vitest'
import { validateImageProxyUrl as validateUrl } from '@/lib/imageProxyValidation'

describe('Image proxy SSRF validation', () => {
  it('rejects HTTP loopback addresses', async () => {
    await expect(validateUrl('http://127.0.0.1/image.jpg')).rejects.toThrow()
  })

  it('rejects private addresses', async () => {
    await expect(validateUrl('https://10.0.0.1/image.jpg')).rejects.toThrow()
  })

  it('rejects non-http protocols', async () => {
    await expect(validateUrl('file:///etc/passwd')).rejects.toThrow()
  })
})
