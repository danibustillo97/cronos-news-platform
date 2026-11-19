import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Security migration', () => {
  const sql = readFileSync(
    resolve(process.cwd(), '../infrastructure/database/migrations/20261119_security_rls_storage.sql'),
    'utf8'
  )

  it('does not allow public TikTok account access', () => {
    expect(sql).toContain('revoke all on public.tiktok_accounts from anon')
  })

  it('keeps media writes admin-only', () => {
    expect(sql).toContain('media_admin_insert')
    expect(sql).toContain('public.cronos_is_admin()')
  })

  it('keeps published news public while writes are admin-only', () => {
    expect(sql).toContain('status = \'published\'')
    expect(sql).toContain('admin_write_news')
  })
})
