import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  Radio,
  Server,
  Star,
  Users,
} from 'lucide-react'

import { GlowCard } from '@/components/ui/glow-card'
import { apiUrl } from '@/lib/api'
import { formatAgo, useLedgerHealth } from '@/hooks/use-ledger-health'
import { useMachineRole } from '@/hooks/use-machine-role'
import { useFavoriteModelIds } from '@/hooks/use-favorite-model-ids'
import {
  getMachineRole,
  parseCoordinatorApiUrl,
  setCoordinatorApiUrl,
  setLocalInferenceUrl,
  setMachineRole,
  type MachineRole,
} from '@/lib/machine-role'
import { copyTextToClipboard } from '@/lib/copy-to-clipboard'
import { buildInviteLink } from '@/lib/invite-link'
import { toggleFavoriteModelId } from '@/lib/favorite-models'
import { cn } from '@/lib/utils'

type CatalogModel = { id: string; name?: string; family?: string }

type SettingsPageProps = {
  nodeId: string
  onNodeIdChange: (id: string) => void
}

export function SettingsPage({ nodeId, onNodeIdChange }: SettingsPageProps) {
  const snap = useMachineRole()
  const ledgerHealth = useLedgerHealth()
  const favoriteIds = useFavoriteModelIds()
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])

  const [draftRole, setDraftRole] = useState<MachineRole>(() => getMachineRole())
  const [draftCoord, setDraftCoord] = useState(snap.coordinatorApiUrl)
  const [draftLocal, setDraftLocal] = useState(snap.localInferenceUrl)
  const [testBusy, setTestBusy] = useState(false)
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [inviteCopyError, setInviteCopyError] = useState<string | null>(null)
  const [hbBusy, setHbBusy] = useState(false)
  const [hbMsg, setHbMsg] = useState<string | null>(null)

  useEffect(() => {
    setDraftRole(snap.role)
    setDraftCoord(snap.coordinatorApiUrl)
    setDraftLocal(snap.localInferenceUrl)
  }, [snap.role, snap.coordinatorApiUrl, snap.localInferenceUrl])

  const applyConnection = useCallback(() => {
    const normalizedCoord = parseCoordinatorApiUrl(draftCoord)
    if (draftRole === 'contributor' && !normalizedCoord) {
      setTestMsg('Set a valid coordinator URL (e.g. http://192.168.x.x:8787).')
      return
    }
    const localNorm =
      parseCoordinatorApiUrl(draftLocal) ||
      draftLocal.trim().replace(/\/$/, '') ||
      'http://127.0.0.1:52415'
    setLocalInferenceUrl(localNorm)
    setCoordinatorApiUrl(normalizedCoord)
    setMachineRole(draftRole)
    setTestMsg(null)
  }, [draftCoord, draftLocal, draftRole])

  const sendTestHeartbeat = useCallback(async () => {
    if (!nodeId.trim()) {
      setHbMsg('Set a node id first (we use it for the ledger).')
      return
    }
    setHbBusy(true)
    setHbMsg(null)
    try {
      const r = await fetch(apiUrl('/api/nodes/heartbeat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId.trim() }),
      })
      if (r.ok) {
        setHbMsg(
          'Heartbeat accepted — the host should list this laptop under Contribute → App connections within ~30s.',
        )
      } else {
        const t = await r.text()
        setHbMsg(t || `HTTP ${r.status}`)
      }
    } catch (e) {
      setHbMsg(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setHbBusy(false)
    }
  }, [nodeId])

  const testCoordinator = useCallback(async () => {
    const base = parseCoordinatorApiUrl(draftCoord)
    if (!base) {
      setTestMsg('Enter a valid URL first.')
      return
    }
    setTestBusy(true)
    setTestMsg(null)
    try {
      const r = await fetch(`${base}/api/cluster/state`)
      if (r.ok) {
        setTestMsg('Connected — coordinator Colyni API responded (cluster snapshot).')
      } else {
        setTestMsg(`Reachable but error: HTTP ${r.status}`)
      }
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : 'Could not reach host (CORS or network).')
    } finally {
      setTestBusy(false)
    }
  }, [draftCoord])

  const fetchLocalNodeId = useCallback(async () => {
    const base = (parseCoordinatorApiUrl(draftLocal) || draftLocal.trim()).replace(/\/$/, '')
    if (!base) return
    try {
      const r = await fetch(`${base}/node_id`)
      if (!r.ok) return
      const text = await r.text()
      const id = text.trim().replace(/^"|"$/g, '')
      if (id) onNodeIdChange(id)
    } catch {
      /* ignore */
    }
  }, [draftLocal, onNodeIdChange])

  const [catalog, setCatalog] = useState<CatalogModel[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const reloadCatalog = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const r = await fetch(apiUrl('/api/models'))
      if (!r.ok) {
        setLoadError(`Could not load models (${r.status})`)
        setCatalog([])
        return
      }
      const body = (await r.json()) as { data?: CatalogModel[] }
      const rows = (body.data ?? []).map((m) => ({
        id: String(m.id),
        name: m.name ? String(m.name) : undefined,
        family: m.family ? String(m.family) : undefined,
      }))
      setCatalog(rows)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Request failed')
      setCatalog([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadCatalog()
  }, [reloadCatalog, snap.role, snap.coordinatorApiUrl])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return catalog
    return catalog.filter((m) => {
      const id = m.id.toLowerCase()
      const name = (m.name ?? '').toLowerCase()
      const family = (m.family ?? '').toLowerCase()
      return id.includes(q) || name.includes(q) || family.includes(q)
    })
  }, [catalog, query])

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-8">
      <header className="animate-fade-up">
        <h1 className="text-[22px] font-semibold tracking-tight text-cy-text">Settings</h1>
        <p className="mt-1 max-w-lg text-[14px] text-cy-secondary">
          Choose how this laptop connects to the cluster, then pick favorite models for Chat.
        </p>
      </header>

      {/* Live Colyni API status (port 8787) — separate from exo mesh on :52415 */}
      <GlowCard className="animate-fade-up" innerClassName="p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
              ledgerHealth.ok === true
                ? 'bg-cy-green-light text-cy-green'
                : ledgerHealth.ok === false
                  ? 'bg-cy-error-light text-cy-error'
                  : 'bg-cy-inset text-cy-muted',
            )}
            aria-hidden
          >
            {ledgerHealth.checking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Radio className="size-4" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-[14px] font-medium text-cy-text">Colyni API (ledger)</h2>
            <p className="text-[12px] leading-relaxed text-cy-secondary">
              {snap.role === 'coordinator' ? (
                <>
                  This app talks to the Colyni backend on <span className="font-mono">8787</span>{' '}
                  (credits, heartbeats, chat proxy). That is{' '}
                  <strong className="font-medium text-cy-text">not</strong> the same process as the
                  GPU mesh on <span className="font-mono">52415</span> — exo can look healthy while
                  the API here is down or blocked.
                </>
              ) : snap.coordinatorApiUrl.trim() ? (
                <>
                  Pings the host you saved (
                  <span className="break-all font-mono text-[11px] text-cy-text">
                    {snap.coordinatorApiUrl.replace(/\/$/, '')}
                  </span>
                  ). If this stays red, fix CORS on the host or confirm{' '}
                  <span className="font-mono text-[11px]">demo-coordinator.sh</span> is running — the
                  mesh on :52415 can still work without this.
                </>
              ) : (
                <>
                  Set coordinator URL below and <strong className="text-cy-text">Save connection</strong>{' '}
                  to monitor reachability.
                </>
              )}
            </p>
            {snap.role === 'contributor' && snap.coordinatorApiUrl.trim() ? (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[12px]">
                {ledgerHealth.ok === true && ledgerHealth.lastOkAt != null && (
                  <span className="inline-flex items-center gap-1.5 text-cy-green-dark">
                    <Activity className="size-3.5" aria-hidden />
                    OK
                    {ledgerHealth.latencyMs != null && (
                      <span className="tabular-nums text-cy-secondary">
                        · {ledgerHealth.latencyMs} ms
                      </span>
                    )}
                    <span className="text-cy-muted">· checked {formatAgo(ledgerHealth.lastOkAt)}</span>
                  </span>
                )}
                {ledgerHealth.ok === false && (
                  <span className="text-cy-error">
                    Unreachable — {ledgerHealth.lastError ?? 'unknown error'}
                  </span>
                )}
                {ledgerHealth.ok === null && !ledgerHealth.checking && (
                  <span className="text-cy-muted">Waiting for first check…</span>
                )}
                <button
                  type="button"
                  onClick={() => void ledgerHealth.refresh()}
                  className="rounded-md border border-cy-border px-2 py-0.5 text-[11px] font-medium text-cy-secondary hover:bg-cy-inset"
                >
                  Refresh now
                </button>
              </div>
            ) : snap.role === 'coordinator' ? (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[12px]">
                {ledgerHealth.ok === true && ledgerHealth.lastOkAt != null && (
                  <span className="inline-flex items-center gap-1.5 text-cy-green-dark">
                    <Activity className="size-3.5" aria-hidden />
                    Local backend reachable
                    {ledgerHealth.latencyMs != null && (
                      <span className="tabular-nums text-cy-secondary">
                        · {ledgerHealth.latencyMs} ms
                      </span>
                    )}
                    <span className="text-cy-muted">· {formatAgo(ledgerHealth.lastOkAt)}</span>
                  </span>
                )}
                {ledgerHealth.ok === false && (
                  <span className="text-cy-error">
                    Not reachable — {ledgerHealth.lastError ?? 'unknown error'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void ledgerHealth.refresh()}
                  className="rounded-md border border-cy-border px-2 py-0.5 text-[11px] font-medium text-cy-secondary hover:bg-cy-inset"
                >
                  Refresh now
                </button>
              </div>
            ) : null}

            {snap.role === 'contributor' && snap.coordinatorApiUrl.trim() && (
              <div className="mt-3 border-t border-cy-border pt-3">
                <p className="text-[11px] leading-relaxed text-cy-muted">
                  <span className="font-medium text-cy-text">Appear on the host&apos;s list:</span>{' '}
                  Chat sends heartbeats automatically, or use a one-off test (needs node id).
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void sendTestHeartbeat()}
                    disabled={hbBusy || !nodeId.trim()}
                    className="inline-flex items-center gap-2 rounded-lg border border-cy-border bg-cy-surface px-3 py-1.5 text-[12px] font-medium text-cy-text transition hover:bg-cy-inset disabled:opacity-50"
                  >
                    {hbBusy ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Radio className="size-3.5 text-cy-green" aria-hidden />
                    )}
                    Send test heartbeat
                  </button>
                  {hbMsg && (
                    <span className="text-[11px] leading-snug text-cy-secondary">{hbMsg}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </GlowCard>

      {/* Machine role */}
      <GlowCard className="animate-fade-up delay-75" innerClassName="p-6">
        <h2 className="text-[15px] font-medium text-cy-text">This Mac&apos;s role</h2>
        <p className="mt-1 text-[13px] text-cy-secondary">
          Switch any time — both you and Dan can use the same build; only the connection settings
          change.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setDraftRole('coordinator')}
            className={cn(
              'rounded-xl border p-4 text-left transition-colors',
              draftRole === 'coordinator'
                ? 'border-cy-green/50 bg-cy-green-light/70'
                : 'border-cy-border bg-cy-surface hover:border-cy-green/25',
            )}
          >
            <div className="flex items-center gap-2">
              <Server className="size-5 text-cy-green" strokeWidth={1.75} />
              <span className="text-[14px] font-semibold text-cy-text">Runs the LLM here</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-cy-secondary">
              This Mac runs <span className="font-mono">colyni-cluster</span> and the Colyni backend.
              Use the normal dev commands on this machine.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setDraftRole('contributor')}
            className={cn(
              'rounded-xl border p-4 text-left transition-colors',
              draftRole === 'contributor'
                ? 'border-cy-green/50 bg-cy-green-light/70'
                : 'border-cy-border bg-cy-surface hover:border-cy-green/25',
            )}
          >
            <div className="flex items-center gap-2">
              <Users className="size-5 text-cy-green" strokeWidth={1.75} />
              <span className="text-[14px] font-semibold text-cy-text">Contributor</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-cy-secondary">
              Chat uses someone else&apos;s Colyni API. You still run a local worker so this laptop
              can join the cluster and earn credits.
            </p>
          </button>
        </div>

        {draftRole === 'contributor' && (
          <div className="mt-6 space-y-4 rounded-xl border border-cy-border bg-cy-inset/80 p-4">
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-cy-muted">
                Coordinator Colyni API
              </label>
              <p className="mt-0.5 text-[12px] text-cy-muted">
                The other person&apos;s backend URL (port <span className="font-mono">8787</span>).
                They must add your browser origin to <span className="font-mono">CORS_ORIGINS</span>{' '}
                on their Mac.
              </p>
              <input
                type="url"
                value={draftCoord}
                onChange={(e) => setDraftCoord(e.target.value)}
                placeholder="http://192.168.1.10:8787"
                className="mt-2 w-full rounded-lg border border-cy-border bg-cy-surface px-3 py-2.5 font-mono text-[13px] text-cy-text placeholder:text-cy-muted focus:border-cy-green/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-cy-muted">
                Your worker on this Mac
              </label>
              <p className="mt-0.5 text-[12px] text-cy-muted">
                Where <span className="font-mono">colyni-cluster</span> listens on this laptop (for
                your node id). Usually <span className="font-mono">http://127.0.0.1:52415</span>.
              </p>
              <input
                type="url"
                value={draftLocal}
                onChange={(e) => setDraftLocal(e.target.value)}
                placeholder="http://127.0.0.1:52415"
                className="mt-2 w-full rounded-lg border border-cy-border bg-cy-surface px-3 py-2.5 font-mono text-[13px] text-cy-text placeholder:text-cy-muted focus:border-cy-green/40 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void testCoordinator()}
                disabled={testBusy}
                className="inline-flex items-center gap-2 rounded-lg border border-cy-border bg-cy-surface px-3 py-2 text-[13px] font-medium text-cy-text transition hover:bg-cy-inset disabled:opacity-50"
              >
                {testBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-4 text-cy-green" aria-hidden />
                )}
                Test coordinator connection
              </button>
              {testMsg && (
                <span className="text-[12px] text-cy-secondary">{testMsg}</span>
              )}
            </div>

            <div>
              <label className="text-[11px] font-medium uppercase tracking-wider text-cy-muted">
                Your node id (this Mac)
              </label>
              <p className="mt-0.5 text-[12px] text-cy-muted">
                Used for credits and heartbeats. We try to read it from your local worker.
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={nodeId}
                  onChange={(e) => onNodeIdChange(e.target.value)}
                  placeholder="paste if auto-detect fails"
                  className="min-w-0 flex-1 rounded-lg border border-cy-border bg-cy-surface px-3 py-2.5 font-mono text-[12px] text-cy-text placeholder:text-cy-muted focus:border-cy-green/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void fetchLocalNodeId()}
                  className="shrink-0 rounded-lg bg-cy-green px-3 py-2.5 text-[13px] font-medium text-cy-bg transition hover:opacity-90"
                >
                  Refresh from local worker
                </button>
              </div>
            </div>
          </div>
        )}

        {draftRole === 'coordinator' && (
          <details className="mt-5 rounded-xl border border-cy-border bg-cy-inset/50 px-4 py-3 text-[13px] text-cy-secondary">
            <summary className="cursor-pointer font-medium text-cy-text">Terminal (this Mac)</summary>
            <p className="mt-2 text-[12px] leading-relaxed">
              <span className="font-medium text-cy-text">Easiest for demos:</span>{' '}
              <span className="font-mono">./scripts/demo-coordinator.sh</span> — builds the UI, starts{' '}
              <span className="font-mono">colyni-cluster</span> and the Colyni API on{' '}
              <span className="font-mono">0.0.0.0:8787</span>, and prints LAN URLs. Add{' '}
              <span className="font-mono">WITH_VITE=1</span> for hot-reload on :5173.
            </p>
            <p className="mt-2 text-[12px] leading-relaxed">
              Manual steps and multi-Mac notes: <span className="font-mono">colyni/quickstart.md</span>{' '}
              · inference details: <span className="font-mono">colyni/inference/README.md</span>.
            </p>
          </details>
        )}

        {draftRole === 'contributor' && (
          <details className="mt-4 rounded-xl border border-cy-border bg-cy-inset/50 px-4 py-3 text-[13px] text-cy-secondary">
            <summary className="cursor-pointer font-medium text-cy-text">Terminal (this Mac)</summary>
            <p className="mt-2 text-[12px] leading-relaxed">
              <span className="font-medium text-cy-text">Easiest for demos:</span>{' '}
              <span className="font-mono">./scripts/demo-contributor.sh</span> — starts{' '}
              <span className="font-mono">colyni-cluster</span> on this laptop so it joins the mesh, then
              use Settings above to point at the host&apos;s API. Add <span className="font-mono">WITH_VITE=1</span>{' '}
              if you want the React app from this machine on :5173.
            </p>
            <p className="mt-2 text-[12px] leading-relaxed">
              Discovery and ports: <span className="font-mono">colyni/inference/README.md</span> — same
              Wi‑Fi, firewall open for cluster traffic.
            </p>
          </details>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={applyConnection}
            className="rounded-lg bg-cy-green px-4 py-2.5 text-[13px] font-medium text-cy-bg transition hover:opacity-90"
          >
            Save connection
          </button>
          <span className="text-[12px] text-cy-muted">
            Saves to this browser only (not synced across devices).
          </span>
        </div>
      </GlowCard>

      {snap.role === 'coordinator' && (
        <GlowCard className="animate-fade-up delay-100" innerClassName="p-6">
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cy-inset">
              <Link2 size={16} strokeWidth={1.5} className="text-cy-secondary" />
            </div>
            <div>
              <h2 className="text-[15px] font-medium text-cy-text">Invite a teammate</h2>
              <p className="mt-0.5 text-[13px] text-cy-secondary">
                Open this app using your <span className="font-medium text-cy-text">LAN IP</span> (not
                localhost), then copy the link. They open it on the same Wi‑Fi — contributor mode and
                API URL are filled in automatically.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1 rounded-lg border border-cy-border bg-cy-inset px-3 py-2.5 font-mono text-[11px] leading-relaxed text-cy-muted break-all">
              {(() => {
                const { url, warning } = buildInviteLink()
                if (warning) return warning
                return url || '—'
              })()}
            </div>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const { url, warning } = buildInviteLink()
                  setInviteCopyError(null)
                  if (warning || !url) return
                  const ok = await copyTextToClipboard(url)
                  if (ok) {
                    setInviteCopied(true)
                    window.setTimeout(() => setInviteCopied(false), 2000)
                  } else {
                    setInviteCopyError(
                      'Could not use the clipboard on this page. Select the URL above and copy manually (⌘C / Ctrl+C).',
                    )
                  }
                })()
              }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-cy-green px-4 py-2.5 text-[13px] font-medium text-cy-bg transition hover:opacity-90"
            >
              {inviteCopied ? (
                <>
                  <CheckCircle2 className="size-4" aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" aria-hidden />
                  Copy invite link
                </>
              )}
            </button>
          </div>
          {inviteCopyError && (
            <p className="mt-2 text-[12px] text-cy-error" role="alert">
              {inviteCopyError}
            </p>
          )}
        </GlowCard>
      )}

      {/* Favorites */}
      <GlowCard className="animate-fade-up delay-100" innerClassName="p-6">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cy-inset">
            <Star size={16} strokeWidth={1.5} className="text-cy-secondary" />
          </div>
          <div>
            <h2 className="text-[15px] font-medium text-cy-text">Favorite models</h2>
            <p className="mt-0.5 text-[13px] text-cy-secondary">
              {favoriteIds.length} selected · Chat only lists these
            </p>
          </div>
        </div>

        <label className="mt-5 block text-[11px] font-medium uppercase tracking-wider text-cy-muted">
          Filter catalog
        </label>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by id, name, or family…"
          disabled={loading || !!loadError}
          className="mt-1.5 w-full rounded-lg border border-cy-border bg-cy-inset px-3 py-2.5 font-mono text-[13px] text-cy-text placeholder:text-cy-muted focus:border-cy-green/40 focus:outline-none disabled:opacity-50"
        />

        {loading && (
          <div className="mt-6 flex items-center gap-2 text-[13px] text-cy-muted">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading models…
          </div>
        )}

        {loadError && (
          <p className="mt-4 text-[13px] text-cy-error">{loadError}</p>
        )}

        {!loading && !loadError && catalog.length === 0 && (
          <p className="mt-4 text-[13px] text-cy-muted">No model cards from the cluster yet.</p>
        )}

        {!loading && !loadError && catalog.length > 0 && (
          <ul className="mt-4 max-h-[min(420px,55vh)] overflow-y-auto rounded-lg border border-cy-border bg-cy-inset/80">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-[13px] text-cy-muted">No matches for this filter.</li>
            ) : (
              filtered.map((m) => {
                const on = favoriteSet.has(m.id)
                return (
                  <li
                    key={m.id}
                    className="flex items-stretch border-b border-cy-border last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => toggleFavoriteModelId(m.id)}
                      className={cn(
                        'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-cy-surface',
                        on && 'bg-cy-green-light/40',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border',
                          on
                            ? 'border-cy-green/40 bg-cy-green-light text-cy-green-dark'
                            : 'border-cy-border bg-cy-surface text-cy-muted',
                        )}
                        aria-hidden
                      >
                        <Star
                          size={16}
                          strokeWidth={1.75}
                          className={on ? 'fill-cy-green text-cy-green' : ''}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[12px] text-cy-text">{m.id}</span>
                        {(m.name && m.name !== m.id) || m.family ? (
                          <span className="mt-0.5 block text-[11px] text-cy-muted">
                            {[m.name && m.name !== m.id ? m.name : null, m.family || null]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        )}

        {!loading && !loadError && catalog.length > 0 && (
          <p className="mt-3 text-[11px] text-cy-muted">
            Showing {filtered.length} of {catalog.length} models
          </p>
        )}
      </GlowCard>
    </div>
  )
}
