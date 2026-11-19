import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/supabaseAuth'

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }
  }
  const body = await request.json().catch(() => null)
  const accessToken = typeof body?.accessToken === 'string' ? body.accessToken : null
  if (!accessToken) {
    return NextResponse.json({ error: 'Access token required' }, { status: 400 })
  }

  const copied = new NextRequest(request.url, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  try {
    await requireAdmin(copied)
  } catch {
    return NextResponse.json({ error: 'Administrator session required' }, { status: 403 })
  }

  const response = NextResponse.json({ authenticated: true })
  response.cookies.set('cronos_access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60,
    path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false })
  response.cookies.delete('cronos_access_token')
  return response
}
