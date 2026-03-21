import { useCallback, useEffect, useState } from 'react'

import { useMachineRole } from '@/hooks/use-machine-role'
import { apiUrl } from '@/lib/api'

export type LedgerHealthState = {
  /** null = skipped (e.g. contributor with no URL yet) or not yet checked */
  ok: boolean | null
  lastOkAt: number | null
  lastError: string | null
  latencyMs: number | null
  checking: boolean
  refresh: () => void
}

function formatAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  return `${m}m ago`
}

export { formatAgo }

/**
 * Polls GET /health on the Colyni backend (coordinator: local; contributor: saved coordinator URL).
 * This is independent of exo/colyni-cluster mesh health on :52415.
 */
export function useLedgerHealth(pollMs = 15_000): LedgerHealthState {
  const { role, coordinatorApiUrl } = useMachineRole()
  const [ok, setOk] = useState<boolean | null>(null)
  const [lastOkAt, setLastOkAt] = useState<number | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)

  const refresh = useCallback(async () => {
    if (role === 'contributor' && !coordinatorApiUrl.trim()) {
      setOk(null)
      setLastOkAt(null)
      setLastError(null)
      setLatencyMs(null)
      return
    }
    setChecking(true)
    const t0 = performance.now()
    try {
      const r = await fetch(apiUrl('/health'))
      const ms = Math.round(performance.now() - t0)
      setLatencyMs(ms)
      if (r.ok) {
        setOk(true)
        setLastOkAt(Date.now())
        setLastError(null)
      } else {
        setOk(false)
        setLastError(`HTTP ${r.status}`)
      }
    } catch (e) {
      setOk(false)
      setLatencyMs(null)
      setLastError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setChecking(false)
    }
  }, [role, coordinatorApiUrl])

  useEffect(() => {
    if (role === 'contributor' && !coordinatorApiUrl.trim()) {
      setOk(null)
      setLastOkAt(null)
      setLastError(null)
      setLatencyMs(null)
      return
    }
    void refresh()
    const id = window.setInterval(() => void refresh(), pollMs)
    return () => window.clearInterval(id)
  }, [role, coordinatorApiUrl, pollMs, refresh])

  return { ok, lastOkAt, lastError, latencyMs, checking, refresh }
}
