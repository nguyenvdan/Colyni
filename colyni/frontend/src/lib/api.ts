/**
 * Colyni API base URL.
 * - Dev: leave `VITE_COLYNI_API_URL` unset — use same-origin paths; Vite proxies to the backend.
 * - Prod (static on another host): set `VITE_COLYNI_API_URL=https://your-api.example.com` at build time.
 */
const raw = import.meta.env.VITE_COLYNI_API_URL as string | undefined
const base = typeof raw === 'string' && raw.length > 0 ? raw.replace(/\/$/, '') : ''

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}
