import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const lines = (process.env.ADS_TXT_LINES || process.env.NEXT_PUBLIC_ADS_TXT_LINES || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  return new NextResponse(lines.join('\n') + (lines.length ? '\n' : ''), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
