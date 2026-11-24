import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { requireAdmin } from './supabaseAuth'

describe('Next.js admin authorization', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-anon'
    process.env.ADMIN_USER_IDS = ''
    process.env.ADMIN_EMAILS = ''
  })

  it('rejects an anonymous request', async () => {
    const request = new NextRequest('https://preview.example.com/admin')
    await expect(requireAdmin(request)).rejects.toMatchObject({ status: 401 })
  })

  it('rejects an authenticated non-admin', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'user-1',
      email: 'user@example.com',
      app_metadata: { role: 'authenticated' },
      user_metadata: { role: 'admin' },
    }), { status: 200 })))
    const request = new NextRequest('https://preview.example.com/admin', {
      headers: { authorization: 'Bearer test-token' },
    })
    await expect(requireAdmin(request)).rejects.toMatchObject({ status: 403 })
  })

  it('accepts an app_metadata administrator', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'admin-1',
      email: 'admin@example.com',
      app_metadata: { role: 'admin' },
    }), { status: 200 })))
    const request = new NextRequest('https://preview.example.com/admin', {
      headers: { authorization: 'Bearer test-token' },
    })
    await expect(requireAdmin(request)).resolves.toMatchObject({ id: 'admin-1' })
  })
})
