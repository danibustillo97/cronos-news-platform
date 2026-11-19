import { NextRequest, NextResponse } from 'next/server'

export class AdminAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function parseCookieHeader(request: NextRequest): string | null {
  return request.cookies.get('cronos_access_token')?.value
    || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
    || null
}

export async function requireAdmin(request: NextRequest) {
  const token = parseCookieHeader(request)
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!token || !url || !anonKey) {
    throw new AdminAuthError(401, 'Authentication required')
  }

  const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new AdminAuthError(401, 'Invalid or expired session')
  }

  const user = await response.json() as {
    id?: string
    email?: string
    app_metadata?: Record<string, unknown>
    user_metadata?: Record<string, unknown>
  }
  if (!user.id) {
    throw new AdminAuthError(401, 'Invalid session')
  }

  const role = typeof user.app_metadata?.role === 'string'
    ? user.app_metadata.role
    : null
  const allowedRoles = new Set(['admin', 'administrator', 'editor'])
  const allowedIds = new Set((process.env.ADMIN_USER_IDS || '').split(',').map(v => v.trim()).filter(Boolean))
  const allowedEmails = new Set((process.env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean))

  if (
    !allowedRoles.has(role || '')
    && !allowedIds.has(user.id)
    && !(user.email && allowedEmails.has(user.email.toLowerCase()))
  ) {
    throw new AdminAuthError(403, 'Administrator access required')
  }

  return user
}

export function adminAuthError(error: unknown) {
  if (error instanceof AdminAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return NextResponse.json({ error: 'Authentication could not be verified' }, { status: 503 })
}
