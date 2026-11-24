import { NextRequest, NextResponse } from 'next/server'

async function validateAdmin(request: NextRequest): Promise<boolean> {
  const accessToken = request.cookies.get('cronos_access_token')?.value
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!accessToken || !url || !anonKey) return false

  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
      },
      cache: 'no-store',
    })
    if (!response.ok) return false
    const user = await response.json() as {
      id?: string
      email?: string
      app_metadata?: Record<string, unknown>
    }
    if (!user.id) return false

    const role = typeof user.app_metadata?.role === 'string'
      ? user.app_metadata.role
      : null
    const allowedRoles = new Set(['admin', 'administrator', 'editor'])
    const allowedIds = new Set((process.env.ADMIN_USER_IDS || '').split(',').map(v => v.trim()).filter(Boolean))
    const allowedEmails = new Set((process.env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean))
    return allowedRoles.has(role || '')
      || allowedIds.has(user.id)
      || Boolean(user.email && allowedEmails.has(user.email.toLowerCase()))
  } catch {
    return false
  }
}

function redirectToLogin(request: NextRequest, pathname: string) {
  const login = new URL('/admin/login', request.url)
  login.searchParams.set('next', pathname)
  return NextResponse.redirect(login)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/admin') || pathname.startsWith('/admin/login')) {
    return NextResponse.next()
  }
  if (!(await validateAdmin(request))) return redirectToLogin(request, pathname)
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
