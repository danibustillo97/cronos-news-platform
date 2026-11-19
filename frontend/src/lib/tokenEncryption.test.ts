import { describe, expect, it } from 'vitest'
import { decryptToken, encryptToken } from './tokenEncryption'

describe('OAuth token encryption', () => {
  it('round trips a token and uses a different ciphertext', () => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
    const token = 'plain-sensitive-token'
    const first = encryptToken(token)
    const second = encryptToken(token)
    expect(decryptToken(first)).toBe(token)
    expect(decryptToken(second)).toBe(token)
    expect(first).not.toBe(second)
  })

  it('rejects invalid ciphertext', () => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
    expect(() => decryptToken('invalid.ciphertext')).toThrow()
  })
})
