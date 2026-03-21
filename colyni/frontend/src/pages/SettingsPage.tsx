import { useEffect, useMemo, useState } from 'react'
import { Loader2, Star } from 'lucide-react'

import { GlowCard } from '@/components/ui/glow-card'
import { apiUrl } from '@/lib/api'
import { toggleFavoriteModelId } from '@/lib/favorite-models'
import { useFavoriteModelIds } from '@/hooks/use-favorite-model-ids'
import { cn } from '@/lib/utils'

type CatalogModel = { id: string; name?: string; family?: string }

export function SettingsPage() {
  const favoriteIds = useFavoriteModelIds()
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])

  const [catalog, setCatalog] = useState<CatalogModel[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const r = await fetch(apiUrl('/api/models'))
        if (!r.ok) {
          if (!cancelled) setLoadError(`Could not load models (${r.status})`)
          return
        }
        const body = (await r.json()) as { data?: CatalogModel[] }
        const rows = (body.data ?? []).map((m) => ({
          id: String(m.id),
          name: m.name ? String(m.name) : undefined,
          family: m.family ? String(m.family) : undefined,
        }))
        if (!cancelled) setCatalog(rows)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Request failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
          Star models to add them to your favorites. The Chat tab model menu only lists those
          favorites.
        </p>
      </header>

      <GlowCard className="animate-fade-up delay-100" innerClassName="p-6">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cy-inset">
            <Star size={16} strokeWidth={1.5} className="text-cy-secondary" />
          </div>
          <div>
            <h2 className="text-[15px] font-medium text-cy-text">Favorite models</h2>
            <p className="mt-0.5 text-[13px] text-cy-secondary">
              {favoriteIds.length} selected · from the full cluster catalog below
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
