import crypto from 'crypto'

function key(): Buffer {
  const encoded = process.env.OAUTH_TOKEN_ENCRYPTION_KEY
  if (!encoded) throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY is not configured')
  const decoded = Buffer.from(encoded, 'base64')
  if (decoded.length !== 32) throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY must encode 32 bytes')
  return decoded
}

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`
}

export function decryptToken(value: string): string {
  const parts = value.split('.')
  if (parts.length !== 3) throw new Error('Invalid encrypted token')
  const [iv64, tag64, data64] = parts
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv64, 'base64'))
  decipher.setAuthTag(Buffer.from(tag64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data64, 'base64')), decipher.final()]).toString('utf8')
}
