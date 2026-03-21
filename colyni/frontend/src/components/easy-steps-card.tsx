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
          <span className="text-cy-text">Settings</span> — if a friend sent a link, tap{' '}
          <span className="font-medium text-cy-text">Save</span>. (Optional: star models you use
          often.)
        </li>
        <li>
          Tap <span className="font-medium text-cy-text">Chat</span>, open the <span className="font-medium text-cy-text">model</span> menu (chip icon), and pick a model — we load it automatically
          and show when it&apos;s ready.
        </li>
        <li>
          When you see <span className="font-medium text-cy-text">Ready to chat</span>, type in the
          box. If something errors, tap <span className="font-medium text-cy-text">Try again</span> or{' '}
          <span className="font-medium text-cy-text">Open cluster</span>.
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
