import dns from 'node:dns/promises'

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase()
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true
  if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (/^127\./.test(normalized) || /^10\./.test(normalized) || /^0\./.test(normalized)) return true
  if (/^169\.254\./.test(normalized) || /^192\.168\./.test(normalized)) return true
  if (/^172\.(\d{1,3})\./.test(normalized)) {
    const second = Number(normalized.split('.')[1])
    if (second >= 16 && second <= 31) return true
  }
  return false
}

export async function validateImageProxyUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Invalid URL')
  }
  if (url.protocol !== 'https:') throw new Error('HTTPS is required')
  if (url.username || url.password) throw new Error('Credentials are not allowed')

  const allowlist = (process.env.IMAGE_PROXY_ALLOWED_HOSTS || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
  if (allowlist.length > 0) {
    const host = url.hostname.toLowerCase()
    if (!allowlist.some(allowed => host === allowed || host.endsWith(`.${allowed}`))) {
      throw new Error('Host is not allowed')
    }
  }

  let addresses: Array<{ address: string }>
  try {
    addresses = await dns.lookup(url.hostname, { all: true })
  } catch {
    throw new Error('Host could not be resolved')
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Private addresses are not allowed')
  }
  return url
}
