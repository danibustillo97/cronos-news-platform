import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const TIMEOUT_MS = 12000;
const MAX_HTML_CHARS = 2_000_000;
const MAX_TEXT_CHARS = 30_000;

function isPrivateOrLocalHost(hostname: string) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;

  const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
  if (!isIPv4) return false;

  const parts = h.split('.').map(n => Number(n));
  if (parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;

  const [a, b] = parts;

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;

  return false;
}

function validateHttpUrl(input: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: 'URL inválida' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Solo se permiten URLs http/https' };
  }

  if (isPrivateOrLocalHost(url.hostname)) {
    return { ok: false, error: 'Host bloqueado por seguridad' };
  }

  return { ok: true, url };
}

function decodeHtmlEntities(s: string) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html: string) {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMeta(html: string, key: { name?: string; property?: string }) {
  const attr = key.name ? 'name' : 'property';
  const val = (key.name || key.property || '').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`<meta\\s+[^>]*${attr}\\s*=\\s*["']${val}["'][^>]*content\\s*=\\s*["']([^"']+)["'][^>]*>`, 'i');
  const m = html.match(re);
  return m?.[1]?.trim() || '';
}

function getCanonical(html: string) {
  const m = html.match(/<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/i);
  return m?.[1]?.trim() || '';
}

function getTitle(html: string) {
  const og = getMeta(html, { property: 'og:title' });
  if (og) return og;
  const tw = getMeta(html, { name: 'twitter:title' });
  if (tw) return tw;
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]) : '';
}

function getExcerpt(html: string) {
  const og = getMeta(html, { property: 'og:description' });
  if (og) return og;
  const d = getMeta(html, { name: 'description' });
  if (d) return d;
  const tw = getMeta(html, { name: 'twitter:description' });
  if (tw) return tw;
  return '';
}

function getImage(html: string) {
  const og = getMeta(html, { property: 'og:image' });
  if (og) return og;
  const tw = getMeta(html, { name: 'twitter:image' });
  if (tw) return tw;
  return '';
}

function resolveMaybeRelative(base: URL, maybeUrl: string) {
  if (!maybeUrl) return '';
  try {
    return new URL(maybeUrl, base).toString();
  } catch {
    return '';
  }
}

function extractReadableText(html: string) {
  let cleaned = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const article = cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  const main = cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  const body = cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  const scope = article || main || body || cleaned;

  const paragraphs: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(scope))) {
    const text = stripTags(m[1]);
    if (!text) continue;
    if (text.length < 60) continue;
    if (/cookies?|suscr[ií]b|newsletter|publicidad|aceptar|inicia sesi[oó]n|reg[ií]strate/i.test(text)) continue;
    paragraphs.push(text);
    if (paragraphs.length >= 30) break;
  }

  const joined = paragraphs.join('\n\n').trim();
  if (!joined) return stripTags(scope).slice(0, MAX_TEXT_CHARS);
  return joined.slice(0, MAX_TEXT_CHARS);
}

export async function POST(req: NextRequest) {
  let urlInput = '';
  try {
    const body = await req.json();
    urlInput = typeof body?.url === 'string' ? body.url : '';
  } catch {
    urlInput = '';
  }

  if (!urlInput) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  const validated = validateHttpUrl(urlInput);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(validated.url.toString(), {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'NexusNewsImporter/1.0',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed (${res.status})` }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html')) {
      return NextResponse.json({ error: 'La URL no devolvió HTML' }, { status: 415 });
    }

    let html = await res.text();
    if (html.length > MAX_HTML_CHARS) html = html.slice(0, MAX_HTML_CHARS);

    const canonicalRaw = getCanonical(html) || getMeta(html, { property: 'og:url' });
    const sourceUrl = canonicalRaw ? resolveMaybeRelative(validated.url, canonicalRaw) : validated.url.toString();

    const title = getTitle(html);
    const excerpt = getExcerpt(html);
    const imageUrl = resolveMaybeRelative(validated.url, getImage(html));
    const contentText = extractReadableText(html);

    return NextResponse.json(
      {
        sourceUrl,
        title,
        excerpt,
        imageUrl,
        contentText,
      },
      { status: 200 }
    );
  } catch (e: any) {
    const msg = typeof e?.message === 'string' ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    clearTimeout(timeout);
  }
}