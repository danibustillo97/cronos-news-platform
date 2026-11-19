
import { NextRequest, NextResponse } from 'next/server';
import { validateImageProxyUrl } from '@/lib/imageProxyValidation';

export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    let current = await validateImageProxyUrl(imageUrl);
    let response: Response | null = null;

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        response = await fetch(current.toString(), {
          redirect: 'manual',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      if (redirectCount === MAX_REDIRECTS) {
        return NextResponse.json({ error: 'Too many redirects' }, { status: 502 });
      }
      const location = response.headers.get('location');
      if (!location) {
        return NextResponse.json({ error: 'Invalid redirect' }, { status: 502 });
      }
      current = await validateImageProxyUrl(new URL(location, current).toString());
    }

    if (!response?.ok) {
      return NextResponse.json({ error: 'Image fetch failed' }, { status: response?.status === 404 ? 404 : 502 });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!/^image\/(?:jpeg|png|gif|webp|avif|bmp|x-icon)/i.test(contentType)) {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
    }
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Image exceeds size limit' }, { status: 413 });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: 'Image exceeds size limit' }, { status: 413 });
    }
    const buffer = Buffer.from(arrayBuffer);

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
