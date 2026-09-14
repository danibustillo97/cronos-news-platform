// The ONLY place the frontend knows the FastAPI backend's address. Every
// CRONOS business call goes through here — never a Next.js route handler
// (rule #1/#3: Next.js is not the backend).

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
