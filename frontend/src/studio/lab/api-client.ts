// The ONLY place the frontend knows the FastAPI backend's address. Every
// CRONOS business call goes through here — never a Next.js route handler
// (rule #1/#3: Next.js is not the backend).
//
// The default depends on WHERE this runs, because "the backend's address"
// means something different in each context:
//
// - Browser: the correct local architecture is
//     Browser -> http://nexus.local -> Nginx :80 -> Backend :8000
//   (see infrastructure/docker/nginx/nginx.conf's `location /api/` ->
//   proxy_pass to the backend). A RELATIVE path keeps the browser on
//   whatever origin actually served the page (nexus.local, localhost:3000,
//   the real production domain) so Nginx (or the real prod reverse proxy)
//   routes it -- a hardcoded absolute `http://localhost:8000` here made
//   the browser treat it as a cross-origin request and hit CORS the
//   moment the page was served from anything other than that literal
//   host:port (e.g. nexus.local). CORS is not the fix for that -- the
//   request should never have been cross-origin in the first place.
// - Server (Node -- generateMetadata, route handlers under src/app/api/):
//   there is no browser origin to stay same-origin with, and no CORS
//   involved at all (CORS is a browser-only concept) -- this needs a
//   real, absolute host:port, and http://localhost:8000 is correct since
//   the Next.js server process and the backend run on the same machine
//   in local dev.
//
// NEXT_PUBLIC_API_BASE_URL, when set, always wins in either context --
// e.g. production, where the Vercel-hosted frontend and the separately
// deployed backend are genuinely different origins on purpose, and an
// explicit backend URL (with the backend's CORS_ALLOWED_ORIGINS including
// the frontend's real domain) is the correct, intended setup, not a bug.
const isBrowser = typeof window !== 'undefined';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? (isBrowser ? '' : 'http://localhost:8000');

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
