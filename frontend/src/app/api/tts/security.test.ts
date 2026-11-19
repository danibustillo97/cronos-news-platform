import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

describe('TTS limits', () => {
  it('rejects text longer than the configured limit', async () => {
    const request = new NextRequest(
      `http://localhost/api/tts?text=${encodeURIComponent('x'.repeat(1001))}`
    )
    const response = await GET(request)
    expect(response.status).toBe(413)
  })

  it('rejects missing text', async () => {
    const request = new NextRequest('http://localhost/api/tts')
    const response = await GET(request)
    expect(response.status).toBe(400)
  })
})
