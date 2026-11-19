import crypto from 'crypto'

export interface OAuthStatePayload {
  state: string
  codeVerifier: string
  expiresAt: number
}

function secret(): string {
  const value = process.env.OAUTH_STATE_SECRET
  if (!value || value.length < 32) {
    throw new Error('OAUTH_STATE_SECRET must be configured with at least 32 characters')
  }
  return value
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function encodeOAuthState(payload: OAuthStatePayload): string {
  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${serialized}.${sign(serialized)}`
}

export function decodeOAuthState(token: string): OAuthStatePayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [serialized, signature] = parts
  const expected = sign(serialized)
  const actual = Buffer.from(signature)
  const wanted = Buffer.from(expected)
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) return null

  try {
    const payload = JSON.parse(Buffer.from(serialized, 'base64url').toString('utf8')) as OAuthStatePayload
    if (
      typeof payload.state !== 'string'
      || typeof payload.codeVerifier !== 'string'
      || typeof payload.expiresAt !== 'number'
      || payload.expiresAt < Date.now()
    ) return null
    return payload
  } catch {
    return null
  }
}
