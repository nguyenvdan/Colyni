import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Loader2, User } from 'lucide-react'

import { AIChatInput } from '@/components/ui/ai-chat-input'
import { useMachineRole } from '@/hooks/use-machine-role'
import {
  describeLoadStatus,
  findInstanceForModel,
  isModelReadyOnCluster,
} from '@/lib/cluster-model-readiness'
import { parseChatApiError } from '@/lib/chat-errors'
import { apiUrl } from '@/lib/api'
import { cn } from '@/lib/utils'
import { GlowCard } from '@/components/ui/glow-card'

type Msg = { role: 'user' | 'assistant'; content: string }

type ChatErrorState = {
  text: string
  openCluster?: boolean
  tone?: 'error' | 'success'
} | null

type ModelPipeline =
  | { kind: 'idle' }
  | {
      kind: 'loading'
      step: 'checking' | 'placing' | 'waiting'
      computers: number
      detail?: string
    }
  | { kind: 'ready'; computers: number }
  | { kind: 'error'; message: string }

type ChatPageProps = {
  nodeId: string
  onNodeIdChange: (id: string) => void
  label: string
  onLabelChange: (v: string) => void
}

const CHAT_COMPLETION_TIMEOUT_MS = 8 * 60 * 1000
const MODEL_LOAD_POLL_MS = 2000
const MODEL_LOAD_MAX_MS = 15 * 60 * 1000

function parseErrBody(raw: string): string {
  let detail = raw
  try {
    const data = JSON.parse(raw) as {
      detail?: unknown
      error?: { message?: string }
    }
    if (typeof data.detail === 'string') detail = data.detail
    else if (Array.isArray(data.detail))
      detail = data.detail
        .map((x) =>
          typeof x === 'object' && x && 'msg' in x
            ? String((x as { msg: string }).msg)
            : String(x),
        )
        .join(' ')
    else if (data.error?.message) detail = data.error.message
  } catch {
    /* */
  }
  return detail
}

export function ChatPage({ nodeId }: ChatPageProps) {
  const { localInferenceUrl } = useMachineRole()
  const [balance, setBalance] = useState<number | null>(null)
  const [models, setModels] = useState<{ id: string; label?: string }[]>([])
  const [modelId, setModelId] = useState('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ChatErrorState>(null)
  const [pipeline, setPipeline] = useState<ModelPipeline>({ kind: 'idle' })
  const [loadRetry, setLoadRetry] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const loadAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading, pipeline])

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

  useEffect(() => {
    loadAbortRef.current?.abort()
    if (!modelId.trim()) {
      setPipeline({ kind: 'idle' })
      return
    }

    const ac = new AbortController()
    loadAbortRef.current = ac
    const mid = modelId.trim()

    void (async () => {
      setError(null)
      setPipeline({ kind: 'loading', step: 'checking', computers: 0 })

      const fetchState = async () => {
        const r = await fetch(apiUrl('/api/cluster/state'), { signal: ac.signal })
        if (!r.ok) throw new Error(`Cluster state ${r.status}`)
        return (await r.json()) as Record<string, unknown>
      }

      try {
        let state = await fetchState()
        if (ac.signal.aborted) return

        if (isModelReadyOnCluster(state, mid)) {
          const inst = findInstanceForModel(state, mid)
          const n = inst ? describeLoadStatus(state, mid).computers : 1
          setPipeline({ kind: 'ready', computers: Math.max(1, n) })
          return
        }

        setPipeline({
          kind: 'loading',
          step: 'placing',
          computers: 0,
          detail: 'Asking the cluster to load this model…',
        })

        const pr = await fetch(apiUrl('/api/cluster/place-instance'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model_id: mid,
            sharding: 'Pipeline',
            instance_meta: 'MlxRing',
            min_nodes: 1,
          }),
          signal: ac.signal,
        })
        const raw = await pr.text()
        if (!pr.ok) {
          setPipeline({
            kind: 'error',
            message: parseErrBody(raw) || `Could not start model (${pr.status}).`,
          })
          return
        }

        const started = Date.now()
        while (Date.now() - started < MODEL_LOAD_MAX_MS) {
          if (ac.signal.aborted) return
          await new Promise((r) => setTimeout(r, MODEL_LOAD_POLL_MS))
          state = await fetchState()
          if (ac.signal.aborted) return

          const d = describeLoadStatus(state, mid)
          setPipeline({
            kind: 'loading',
            step: 'waiting',
            computers: d.computers,
            detail: d.layerLine ?? undefined,
          })

          if (d.ready) {
            const inst = findInstanceForModel(state, mid)
            const n = inst ? describeLoadStatus(state, mid).computers : 1
            setPipeline({ kind: 'ready', computers: Math.max(1, n) })
            return
          }
        }

        setPipeline({
          kind: 'error',
          message:
            'This is taking too long (15 min). Check the cluster window or terminal, then tap Try again.',
        })
      } catch (e) {
        if (ac.signal.aborted) return
        setPipeline({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Could not load model state.',
        })
      }
    })()

    return () => {
      ac.abort()
    }
  }, [modelId, loadRetry])

  const retryLoad = useCallback(() => {
    setLoadRetry((n) => n + 1)
  }, [])

  const chatInputDisabled = loading || !modelId.trim() || pipeline.kind !== 'ready'

  async function sendChat(text: string) {
    if (!nodeId.trim()) {
      setError({ text: 'No node connected. Visit the Contribute tab first.' })
      return
    }
    if (!modelId.trim()) {
      setError({ text: 'Choose a model in the menu above first.' })
      return
    }
    if (pipeline.kind !== 'ready') {
      setError({ text: 'Wait until the model shows “Ready” above.' })
      return
    }
    setError(null)
    setLoading(true)
    const next: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), CHAT_COMPLETION_TIMEOUT_MS)
    try {
      const r = await fetch(apiUrl('/v1/chat/completions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Colyni-Node': nodeId.trim(),
        },
        body: JSON.stringify({
          model: modelId.trim(),
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          stream: false,
        }),
        signal: controller.signal,
      })
      if (r.status === 402) {
        setError({ text: 'Not enough credits. Contribute compute to earn more.' })
        setLoading(false)
        return
      }
      if (!r.ok) {
        const raw = await r.text()
        const p = parseChatApiError(r.status, raw)
        setError({
          text: p.message,
          openCluster: p.showOpenCluster,
          tone: 'error',
        })
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
      const trimmed = typeof textOut === 'string' ? textOut.trim() : ''
      const assistantText =
        trimmed.length > 0
          ? typeof textOut === 'string'
            ? textOut
            : JSON.stringify(data)
          : '(No text came back — the run finished but the model returned an empty message. Try again, or check the terminal where colyni-cluster is running.)'
      setMessages([...next, { role: 'assistant', content: assistantText }])
      void refreshBalance()
    } catch (e) {
      const aborted =
        (e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError')
      if (aborted) {
        setError({
          text:
            'This is taking too long — we stopped waiting after 8 minutes. The model may still be loading, stuck, or busy. Wait until the cluster UI shows the model as running, then try a shorter question. Check the colyni-cluster terminal for errors.',
          openCluster: true,
          tone: 'error',
        })
      } else {
        setError({ text: e instanceof Error ? e.message : 'Request failed' })
      }
    } finally {
      window.clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100svh-11rem)] max-w-3xl flex-col sm:h-[calc(100svh-160px)]">
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

      {/* Model load status */}
      {modelId.trim() && pipeline.kind === 'loading' && (
        <div
          className="mb-3 rounded-xl border border-cy-green/30 bg-cy-green-light/80 px-4 py-3 text-[13px] text-cy-green-dark"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
            <div>
              <p className="font-semibold text-cy-text">
                {pipeline.computers <= 0
                  ? 'Preparing this model on the cluster…'
                  : `Loading model across ${pipeline.computers} ${
                      pipeline.computers === 1 ? 'computer' : 'computers'
                    }`}
              </p>
              <p className="mt-1 text-[12px] leading-snug text-cy-secondary">
                {pipeline.step === 'placing' && (pipeline.detail ?? 'Starting…')}
                {pipeline.step === 'checking' && 'Checking if the model is already running…'}
                {pipeline.step === 'waiting' &&
                  (pipeline.detail ??
                    'Shards are loading across the cluster — first time can take a few minutes.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {modelId.trim() && pipeline.kind === 'ready' && (
        <div
          className="mb-3 rounded-xl border border-cy-green/40 bg-cy-green-light px-4 py-3 text-[13px] text-cy-green-dark"
          role="status"
          aria-live="polite"
        >
          <p className="font-semibold text-cy-text">Ready to chat</p>
          <p className="mt-0.5 text-[12px] text-cy-secondary">
            This model is running on {pipeline.computers}{' '}
            {pipeline.computers === 1 ? 'machine' : 'machines'}. Type below whenever you like.
          </p>
        </div>
      )}

      {modelId.trim() && pipeline.kind === 'error' && (
        <div className="mb-3 rounded-xl border border-cy-error/25 bg-cy-error-light px-4 py-3 text-[13px] text-cy-error">
          <p>{pipeline.message}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={retryLoad}
              className="inline-flex min-h-[40px] items-center rounded-lg bg-cy-text px-3 py-1.5 text-[13px] font-medium text-white"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                const u = localInferenceUrl.replace(/\/$/, '')
                window.open(u, '_blank', 'noopener,noreferrer')
              }}
              className="inline-flex min-h-[40px] items-center rounded-lg border border-cy-border bg-cy-surface px-3 py-1.5 text-[13px] font-medium text-cy-text"
            >
              Open cluster
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          className={cn(
            'mb-3 rounded-md border px-4 py-2.5 text-[13px]',
            error.tone === 'success'
              ? 'border-cy-green/35 bg-cy-green-light text-cy-green-dark'
              : 'border-cy-error/20 bg-cy-error-light text-cy-error',
          )}
          role="alert"
        >
          <p>{error.text}</p>
          {error.openCluster && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!modelId.trim() || pipeline.kind === 'loading'}
                onClick={retryLoad}
                className="inline-flex min-h-[44px] items-center rounded-xl bg-cy-green px-4 py-2 text-[14px] font-semibold text-cy-bg transition hover:opacity-90 disabled:opacity-50"
              >
                Turn on this model
              </button>
              <button
                type="button"
                onClick={() => {
                  const u = localInferenceUrl.replace(/\/$/, '')
                  window.open(u, '_blank', 'noopener,noreferrer')
                }}
                className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-cy-border bg-cy-surface px-4 py-2 text-[14px] font-medium text-cy-text transition hover:bg-cy-inset"
              >
                See it loading
              </button>
            </div>
          )}
        </div>
      )}

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
              <p className="max-w-xs text-[17px] font-semibold text-cy-text">Chat</p>
              <p className="max-w-sm text-[13px] leading-relaxed text-cy-muted">
                Pick a model from the <span className="font-medium text-cy-text">chip</span> menu
                below. We&apos;ll load it for you and show when it&apos;s ready — then type your
                message.
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

      <div className="relative z-10 pt-2">
        <AIChatInput
          onSend={sendChat}
          disabled={chatInputDisabled}
          modelId={modelId}
          onModelIdChange={setModelId}
          modelOptions={models}
          modelOptionsEmptyHint="No models in the catalog yet — open Settings to add one from Hugging Face, or wait for the cluster to finish starting."
        />
      </div>
    </div>
  )
}
