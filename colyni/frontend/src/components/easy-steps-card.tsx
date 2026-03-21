import { useCallback, useState } from 'react'
import { Sparkles, X } from 'lucide-react'

import { cn } from '@/lib/utils'

const STORAGE_KEY = 'colyni-easy-steps-dismissed-v1'

export function EasyStepsCard({
  className,
  onOpenSettings,
}: {
  className?: string
  onOpenSettings?: () => void
}) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setHidden(true)
  }, [])

  if (hidden) return null

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-cy-green/30 bg-gradient-to-br from-cy-green-light/90 to-cy-green-light/40 px-5 py-4 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-cy-green-dark">
          <Sparkles className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
          <h2 className="text-[15px] font-semibold tracking-tight text-cy-text">
            How to use this (3 steps)
          </h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1 text-cy-muted transition hover:bg-cy-surface/80 hover:text-cy-text"
          aria-label="Hide getting started"
        >
          <X className="size-4" />
        </button>
      </div>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-cy-secondary marker:font-semibold marker:text-cy-green">
        <li>
          <span className="text-cy-text">Open Settings</span> — if a friend sent you a link, you’re
          already almost done. Tap <span className="font-medium text-cy-text">Save</span>. Then tap
          the ⭐ stars on models you like.
        </li>
        <li>
          Come back here and tap <span className="font-medium text-cy-text">Chat</span>. Type
          anything in the box at the bottom.
        </li>
        <li>
          If something turns red and says the model isn’t ready, tap{' '}
          <span className="font-medium text-cy-text">Turn on this model</span> and wait a little —
          big brains take time to wake up.
        </li>
      </ol>
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-3 w-full rounded-xl border border-cy-green/25 bg-cy-surface/80 py-2.5 text-[13px] font-medium text-cy-text transition hover:bg-cy-surface"
        >
          Open Settings
        </button>
      )}
    </div>
  )
}
