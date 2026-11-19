import { describe, expect, it } from 'vitest'
import { decodeOAuthState, encodeOAuthState } from './oauthState'

describe('OAuth state', () => {
  it('accepts a signed, unexpired state', () => {
    process.env.OAUTH_STATE_SECRET = 'test-secret-at-least-32-characters-long'
    const payload = {
      state: 'state-value',
      codeVerifier: 'verifier-value',
      expiresAt: Date.now() + 60_000,
    }
    const encoded = encodeOAuthState(payload)
    expect(decodeOAuthState(encoded)).toEqual(payload)
  })

  it('rejects tampered state', () => {
    process.env.OAUTH_STATE_SECRET = 'test-secret-at-least-32-characters-long'
    const encoded = encodeOAuthState({
      state: 'state-value',
      codeVerifier: 'verifier-value',
      expiresAt: Date.now() + 60_000,
    })
    expect(decodeOAuthState(`${encoded}tampered`)).toBeNull()
  })

  it('rejects expired state', () => {
    process.env.OAUTH_STATE_SECRET = 'test-secret-at-least-32-characters-long'
    const encoded = encodeOAuthState({
      state: 'state-value',
      codeVerifier: 'verifier-value',
      expiresAt: Date.now() - 1,
    })
    expect(decodeOAuthState(encoded)).toBeNull()
  })
})
