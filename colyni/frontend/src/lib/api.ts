/**
 * Colyni API URLs.
 *
 * - **Vite dev (port 5173):** leave env unset — same-origin `/api` and `/v1` are proxied to the
 *   Colyni backend (see `vite.config.ts`).
 * - **Embedded in colyni-cluster (port 52415):** the UI is served from the inference server but
 *   credits + proxies live on the Colyni backend (8787). We resolve the ledger base from
 *   `VITE_COLYNI_LEDGER_URL`, or default to `http://<current-host>:8787` when the page is served
 *   from port 52415.
 * - **Static build on another host:** set `VITE_COLYNI_LEDGER_URL` at build time.
 */
function resolveLedgerBase(): string {
  const env = import.meta.env.VITE_COLYNI_LEDGER_URL as string | undefined
  if (env && env.trim().length > 0) {
    return env.replace(/\/$/, '')
  }
  if (import.meta.env.DEV) {
    return ''
  }
  if (typeof window !== 'undefined') {
    const { port, hostname } = window.location
    if (port === '52415') {
      return `http://${hostname}:8787`
    }
  }
  return ''
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = resolveLedgerBase()
  return base ? `${base}${p}` : p
}
