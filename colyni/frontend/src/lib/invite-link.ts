/**
 * One-click join: ?contributor=1&coordinator=http://HOST:8787&localInference=http://127.0.0.1:52415
 */

import {
  parseCoordinatorApiUrl,
  setCoordinatorApiUrl,
  setLocalInferenceUrl,
  setMachineRole,
} from '@/lib/machine-role'

/** Call once before React renders (e.g. from main.tsx). Returns true if invite params were applied. */
export function applyInviteSearchParams(): boolean {
  if (typeof window === 'undefined') return false
  const qs = new URLSearchParams(window.location.search)
  const contributor = qs.get('contributor') === '1' || qs.get('role') === 'contributor'
  if (!contributor) return false

  const coordRaw = qs.get('coordinator') ?? qs.get('api') ?? ''
  if (!coordRaw.trim()) return false

  let coord: string
  try {
    coord = parseCoordinatorApiUrl(decodeURIComponent(coordRaw)) || coordRaw.trim()
  } catch {
    coord = parseCoordinatorApiUrl(coordRaw) || coordRaw.trim()
  }
  if (!coord) return false

  setCoordinatorApiUrl(coord)
  setMachineRole('contributor')

  const localRaw = qs.get('localInference') ?? qs.get('local') ?? ''
  if (localRaw.trim()) {
    let localInf: string
    try {
      localInf = parseCoordinatorApiUrl(decodeURIComponent(localRaw)) || localRaw.trim()
    } catch {
      localInf = parseCoordinatorApiUrl(localRaw) || localRaw.trim()
    }
    if (localInf) setLocalInferenceUrl(localInf)
  }

  for (const k of ['contributor', 'role', 'coordinator', 'api', 'localInference', 'local']) {
    qs.delete(k)
  }
  const rest = qs.toString()
  const path = window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash
  window.history.replaceState({}, '', path)

  // Survives React StrictMode double-mount (sessionStorage alone does not).
  window.__COLYNI_INVITE_APPLIED__ = true
  return true
}

declare global {
  interface Window {
    /** Set when ?contributor=1 invite URL was applied this page load. */
    __COLYNI_INVITE_APPLIED__?: boolean
  }
}

export function buildInviteLink(): { url: string; warning: string | null } {
  if (typeof window === 'undefined') {
    return { url: '', warning: null }
  }
  const { hostname, host } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return {
      url: '',
      warning:
        'Open this app using your Mac’s LAN IP in the address bar (not localhost), then copy again.',
    }
  }
  const uiBase = `${window.location.protocol}//${host}`
  const coordinatorApi = `http://${hostname}:8787`
  const params = new URLSearchParams({
    contributor: '1',
    coordinator: coordinatorApi,
    localInference: 'http://127.0.0.1:52415',
  })
  return { url: `${uiBase}/?${params.toString()}`, warning: null }
}
