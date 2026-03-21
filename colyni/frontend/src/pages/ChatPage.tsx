import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, User } from 'lucide-react'

import { AIChatInput } from '@/components/ui/ai-chat-input'
import { useFavoriteModelIds } from '@/hooks/use-favorite-model-ids'
import { apiUrl } from '@/lib/api'
import { GlowCard } from '@/components/ui/glow-card'

type Msg = { role: 'user' | 'assistant'; content: string }

type ChatPageProps = {
  nodeId: string
  onNodeIdChange: (id: string) => void
  label: string
  onLabelChange: (v: string) => void
}

export function ChatPage({ nodeId }: ChatPageProps) {
  const favoriteIds = useFavoriteModelIds()
  const [balance, setBalance] = useState<number | null>(null)
  const [models, setModels] = useState<{ id: string; label?: string }[]>([])
  const [modelId, setModelId] = useState('')

  const favoriteOptions = useMemo(() => {
    if (favoriteIds.length === 0 || models.length === 0) return []
    const byId = new Map(models.map((m) => [m.id, m]))
    return favoriteIds.filter((id) => byId.has(id)).map((id) => byId.get(id)!)
  }, [models, favoriteIds])

  const resolvedModelId = modelId || favoriteOptions[0]?.id || ''
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const refreshBalance = useCallback(async () => {
    if (!nodeId.trim()) {
      setBalance(null)
      return
    }
    const r = await fetch(apiUrl(`/api/tokens/${encodeURIComponent(nodeId.trim())}`))
    if (!r.ok) return
    const data = (await r.json()) as { balance: number }
    setBalance(data.balance)
  }, [nodeId])

  useEffect(() => {
    void refreshBalance()
  }, [refreshBalance])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const r = await fetch(apiUrl('/api/models'))
      if (!r.ok || cancelled) return
      const data = (await r.json()) as { data?: { id: string; name?: string }[] }
      const list = (data.data ?? []).map((m) => ({
        id: String(m.id),
        label: m.name ? String(m.name) : undefined,
      }))
      setModels(list)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (favoriteOptions.length === 0) {
      setModelId('')
      return
    }
    setModelId((prev) =>
      prev && favoriteOptions.some((m) => m.id === prev) ? prev : favoriteOptions[0].id,
    )
  }, [favoriteOptions])

  useEffect(() => {
    if (!nodeId.trim()) return
    const beat = () => {
      void fetch(apiUrl('/api/nodes/heartbeat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId.trim() }),
      })
      void refreshBalance()
    }
    beat()
    const t = window.setInterval(beat, 30_000)
    return () => window.clearInterval(t)
  }, [nodeId, refreshBalance])

  async function sendChat(text: string) {
    if (!nodeId.trim()) {
      setError('No node connected. Visit the Contribute tab first.')
      return
    }
    if (!resolvedModelId) {
      setError(
        favoriteIds.length === 0
          ? 'No favorite models. Open Settings to pick models from the catalog.'
          : 'No matching favorites for this cluster. Update your favorites in Settings.',
      )
      return
    }
    setError(null)
    setLoading(true)
    const next: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)

    try {
      const r = await fetch(apiUrl('/v1/chat/completions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Colyni-Node': nodeId.trim(),
        },
        body: JSON.stringify({
          model: resolvedModelId,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          stream: false,
        }),
      })
      if (r.status === 402) {
        setError('Not enough credits. Contribute compute to earn more.')
        setLoading(false)
        return
      }
      if (!r.ok) {
        setError((await r.text()) || r.statusText)
        setLoading(false)
        return
      }
      const data = (await r.json()) as {
        choices?: { message?: { content?: string; reasoning_content?: string } }[]
      }
      const textOut =
        data.choices?.[0]?.message?.content ??
        data.choices?.[0]?.message?.reasoning_content ??
        ''
      setMessages([
        ...next,
        { role: 'assistant', content: typeof textOut === 'string' ? textOut : JSON.stringify(data) },
      ])
      void refreshBalance()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100svh-160px)] max-w-3xl flex-col">
      {/* Balance badge */}
      <div className="mb-4 flex items-center justify-end">
        <div className="flex items-center gap-1.5 rounded-full border border-cy-green/20 bg-cy-green-light px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-cy-green" />
          <span className="font-mono text-[13px] font-semibold tabular-nums text-cy-green">
            {balance ?? '—'}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-cy-green-dark">
            credits
          </span>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-md border border-cy-error/20 bg-cy-error-light px-4 py-2.5 text-[13px] text-cy-error" role="alert">
          {error}
        </p>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4"
      >
        {messages.length === 0 && !loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <GlowCard innerClassName="flex flex-col items-center gap-3 px-10 py-10" proximity={80}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cy-green-light">
                <Bot size={22} strokeWidth={1.5} className="text-cy-green" />
              </div>
              <p className="max-w-xs text-[15px] font-medium text-cy-text">
                What can I help with?
              </p>
              <p className="max-w-sm text-[13px] text-cy-muted">
                Your prompts run on the Colyni cluster. Each costs 5 credits.
              </p>
            </GlowCard>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={
              m.role === 'user'
                ? 'ml-auto flex max-w-[80%] items-start gap-2.5'
                : 'mr-auto flex max-w-[80%] items-start gap-2.5'
            }
          >
            {m.role === 'assistant' && (
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cy-green-light">
                <Bot size={14} strokeWidth={2} className="text-cy-green-dark" />
              </div>
            )}
            <div
              className={
                m.role === 'user'
                  ? 'rounded-2xl rounded-tr-md bg-cy-text px-4 py-3 text-[14px] leading-[1.6] text-white'
                  : 'rounded-2xl rounded-tl-md border border-cy-border bg-cy-surface px-4 py-3 text-[14px] leading-[1.6] text-cy-text'
              }
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
            {m.role === 'user' && (
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cy-text">
                <User size={14} strokeWidth={2} className="text-white" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="mr-auto flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cy-green-light">
              <Bot size={14} strokeWidth={2} className="text-cy-green-dark" />
            </div>
            <div className="rounded-2xl rounded-tl-md border border-cy-border bg-cy-surface px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cy-green" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cy-green [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cy-green [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="pt-2">
        <AIChatInput
          onSend={sendChat}
          disabled={loading}
          modelId={resolvedModelId}
          onModelIdChange={setModelId}
          modelOptions={favoriteOptions}
          modelOptionsEmptyHint="No favorite models — open Settings and star models from the catalog."
        />
      </div>
    </div>
  )
}
