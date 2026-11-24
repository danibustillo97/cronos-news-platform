import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/[...path]/route'

const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('frontend /api/* proxy -> FastAPI backend', () => {
  it('returns a clear 503 when the backend URL is not configured', async () => {
    vi.stubEnv('BACKEND_PUBLIC_URL', '')
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '')
    const res = await GET(new NextRequest('http://site.test/api/categories'), ctx(['categories']))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toMatch(/BACKEND_PUBLIC_URL/)
  })

  it('forwards path, query and the session cookie as a Bearer token', async () => {
    vi.stubEnv('BACKEND_PUBLIC_URL', 'https://backend.test/')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', {
      status: 200, headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const req = new NextRequest('http://site.test/api/editorial/board?x=1', {
      headers: { cookie: 'cronos_access_token=tok123' },
    })
    const res = await GET(req, ctx(['editorial', 'board']))
    expect(res.status).toBe(200)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://backend.test/api/editorial/board?x=1')
    expect((init.headers as Headers).get('authorization')).toBe('Bearer tok123')
  })

  it('passes POST bodies and backend errors through unchanged', async () => {
    vi.stubEnv('BACKEND_PUBLIC_URL', 'https://backend.test')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":"PROVIDER_UNAVAILABLE"}', {
      status: 409, headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const req = new NextRequest('http://site.test/api/editorial/items/a/write', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer h' },
      body: JSON.stringify({ mode: 'ai' }),
    })
    const res = await POST(req, ctx(['editorial', 'items', 'a', 'write']))
    expect(res.status).toBe(409)
    const init = fetchMock.mock.calls[0][1]
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"mode":"ai"}')
    expect((init.headers as Headers).get('authorization')).toBe('Bearer h')
  })

  it('answers 502 when the backend is down', async () => {
    vi.stubEnv('BACKEND_PUBLIC_URL', 'https://backend.test')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const res = await GET(new NextRequest('http://site.test/api/categories'), ctx(['categories']))
    expect(res.status).toBe(502)
  })
})
