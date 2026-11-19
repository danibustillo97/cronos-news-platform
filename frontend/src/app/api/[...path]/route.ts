import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function backendBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL
    || process.env.BACKEND_PUBLIC_URL
  if (!configured) {
    throw new Error('BACKEND_PUBLIC_URL or NEXT_PUBLIC_API_BASE_URL is required')
  }
  return configured.replace(/\/$/, '')
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  let backendUrl: string
  try {
    backendUrl = backendBaseUrl()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backend configuration missing' },
      { status: 503 }
    )
  }

  const { path } = await context.params
  const url = new URL(request.url)
  const target = `${backendUrl}/api/${path.join('/')}${url.search}`

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  if (contentType) headers.set('content-type', contentType)

  const authorization = request.headers.get('authorization')
  const sessionCookie = request.cookies.get('cronos_access_token')?.value
  if (authorization) headers.set('authorization', authorization)
  else if (sessionCookie) headers.set('authorization', `Bearer ${sessionCookie}`)

  let body: BodyInit | undefined
  if (!['GET', 'HEAD'].includes(request.method)) {
    body = await request.arrayBuffer()
  }

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
    })
    const responseBody = await response.arrayBuffer()
    const proxied = new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
      },
    })
    return proxied
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 })
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
