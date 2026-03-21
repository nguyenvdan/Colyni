import { useEffect, useState } from 'react'
import { Droplets, Leaf, Zap, Copy, Check } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

import { AnimatedNumber } from '@/components/animated-number'
import { GlowCard } from '@/components/ui/glow-card'
import { apiUrl } from '@/lib/api'
import { useTheme } from '@/lib/theme'

type ClusterState = Record<string, unknown> | null

function formatBytes(n: number | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  const gb = n / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  const mb = n / 1024 ** 2
  return `${mb.toFixed(0)} MB`
}

function usagePercent(used: number | undefined, total: number | undefined) {
  if (used == null || total == null || total === 0) return 0
  return Math.min(Math.round((used / total) * 100), 100)
}

const KWH_PER_CHAT = 0.22
const LITERS_PER_KWH = 1.8
const CO2_PER_KWH = 0.39
const CHATS_PER_USER_PER_MONTH = 600

function buildProjectionData() {
  const userCounts = [1, 10, 50, 100, 500, 1_000, 5_000, 10_000]
  return userCounts.map((users) => {
    const chats = users * CHATS_PER_USER_PER_MONTH
    const kwh = chats * KWH_PER_CHAT
    return {
      users: users.toLocaleString(),
      usersNum: users,
      water: Math.round(kwh * LITERS_PER_KWH),
      co2: Math.round(kwh * CO2_PER_KWH),
      energy: Math.round(kwh),
    }
  })
}

const projectionData = buildProjectionData()

const CHART_GREEN = '#3d8c5e'
const CHART_CYAN = '#0891b2'
const CHART_AMBER = '#d97706'

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-cy-border bg-cy-surface px-3 py-2 shadow-lg">
      <p className="mb-1 text-[11px] font-medium text-cy-muted">{label} users / mo</p>
      {payload.map((p) => (
        <p key={p.name} className="text-[12px] font-medium" style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  )
}

export function ContributePage() {
  const { theme } = useTheme()
  const gridStroke = theme === 'dark' ? '#2a2a27' : '#e5e5e3'
  const tickFill = theme === 'dark' ? '#5a5a56' : '#a8a8a3'

  const [selfId, setSelfId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [state, setState] = useState<ClusterState>(null)
  const [stateError, setStateError] = useState<string | null>(null)
  const [nodes, setNodes] = useState<
    { node_id: string; label: string; balance: number }[]
  >([])
  const [sustain, setSustain] = useState<{
    completed_chats: number
    energy_kwh_avoided: number
    water_liters_saved: number
    co2_kg_avoided: number
  } | null>(null)

  function copyId() {
    if (!selfId) return
    void navigator.clipboard.writeText(selfId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    void (async () => {
      const r = await fetch(apiUrl('/api/cluster/self-id'))
      const text = await r.text()
      setSelfId(text.trim().replace(/^"|"$/g, '') || text)
    })()
  }, [])

  useEffect(() => {
    const load = async () => {
      const r = await fetch(apiUrl('/api/cluster/state'))
      if (!r.ok) {
        setStateError(`Cluster unreachable (${r.status})`)
        setState(null)
        return
      }
      setStateError(null)
      setState((await r.json()) as Record<string, unknown>)
    }
    void load()
    const t = window.setInterval(load, 10_000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const load = async () => {
      const r = await fetch(apiUrl('/api/nodes'))
      if (!r.ok) return
      const d = (await r.json()) as {
        nodes: { node_id: string; label: string; balance: number }[]
      }
      setNodes(d.nodes ?? [])
    }
    void load()
    const t = window.setInterval(load, 5000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const load = async () => {
      const r = await fetch(apiUrl('/api/sustainability'))
      if (!r.ok) return
      setSustain(await r.json())
    }
    void load()
    const t = window.setInterval(load, 8000)
    return () => window.clearInterval(t)
  }, [])

  const nodeIdentities = state?.nodeIdentities as
    | Record<string, { friendlyName?: string }>
    | undefined
  const nodeMemory = state?.nodeMemory as
    | Record<string, { ramTotal?: { inBytes?: number }; ramAvailable?: { inBytes?: number } }>
    | undefined
  const instances = state?.instances as Record<string, unknown> | undefined

  const ids = new Set<string>()
  if (nodeIdentities) Object.keys(nodeIdentities).forEach((k) => ids.add(k))
  if (nodeMemory) Object.keys(nodeMemory).forEach((k) => ids.add(k))

  const clusterRows = Array.from(ids).map((id) => {
    const idInfo = nodeIdentities?.[id]
    const mem = nodeMemory?.[id]
    const total = mem?.ramTotal?.inBytes
    const available = mem?.ramAvailable?.inBytes
    const used = total != null && available != null ? total - available : undefined
    const name =
      idInfo?.friendlyName && idInfo.friendlyName !== 'Unknown'
        ? idInfo.friendlyName
        : `${id.slice(0, 12)}…`
    return { id, name, used, total }
  })

  const sustainCards = [
    {
      icon: Droplets,
      label: 'Water saved',
      value: sustain?.water_liters_saved ?? 0,
      format: (n: number) => `${n.toFixed(1)} L`,
      color: 'text-cyan-600',
      bg: 'bg-cyan-600/10',
    },
    {
      icon: Leaf,
      label: 'CO₂ avoided',
      value: sustain?.co2_kg_avoided ?? 0,
      format: (n: number) => `${n.toFixed(2)} kg`,
      color: 'text-cy-green',
      bg: 'bg-cy-green/10',
    },
    {
      icon: Zap,
      label: 'Energy avoided',
      value: sustain?.energy_kwh_avoided ?? 0,
      format: (n: number) => `${n.toFixed(3)} kWh`,
      color: 'text-amber-600',
      bg: 'bg-amber-600/10',
    },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div className="animate-fade-up">
        <h1 className="text-[24px] font-semibold tracking-tight text-cy-text">Contribute</h1>
        <p className="mt-2 max-w-lg text-[15px] leading-[1.6] text-cy-secondary">
          Live cluster state and estimated environmental impact of running inference locally.
        </p>
      </div>

      {/* Current impact */}
      <section className="animate-fade-up delay-100">
        <h2 className="mb-4 text-[12px] font-medium uppercase tracking-[0.04em] text-cy-muted">
          Current impact · {sustain?.completed_chats ?? 0} chats
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {sustainCards.map((c) => (
            <GlowCard key={c.label} innerClassName="flex items-start gap-4 p-5">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.bg}`}>
                <c.icon size={18} strokeWidth={1.5} className={c.color} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium uppercase tracking-wider text-cy-muted">
                  {c.label}
                </p>
                <p className="mt-1 font-mono text-[22px] font-semibold leading-none tabular-nums text-cy-text">
                  <AnimatedNumber value={c.value} formatFn={c.format} />
                </p>
              </div>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* Projection charts */}
      <section className="animate-fade-up delay-200 space-y-6">
        <div>
          <h2 className="text-[15px] font-medium text-cy-text">Impact at scale</h2>
          <p className="mt-1 text-[13px] text-cy-secondary">
            Projected monthly savings as the network grows — assuming ~20 chats/user/day.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <GlowCard innerClassName="p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-600/10">
                <Droplets size={14} strokeWidth={1.5} className="text-cyan-600" />
              </div>
              <span className="text-[13px] font-medium text-cy-text">Water (liters/mo)</span>
            </div>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_CYAN} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_CYAN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="users" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="water" name="Water (L)" stroke={CHART_CYAN} fill="url(#waterGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-right font-mono text-[11px] text-cy-muted">
              {projectionData[projectionData.length - 1].water.toLocaleString()} L at 10k users
            </p>
          </GlowCard>

          <GlowCard innerClassName="p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cy-green/10">
                <Leaf size={14} strokeWidth={1.5} className="text-cy-green" />
              </div>
              <span className="text-[13px] font-medium text-cy-text">CO₂ (kg/mo)</span>
            </div>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_GREEN} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="users" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="co2" name="CO₂ (kg)" stroke={CHART_GREEN} fill="url(#co2Grad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-right font-mono text-[11px] text-cy-muted">
              {projectionData[projectionData.length - 1].co2.toLocaleString()} kg at 10k users
            </p>
          </GlowCard>

          <GlowCard innerClassName="p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-600/10">
                <Zap size={14} strokeWidth={1.5} className="text-amber-600" />
              </div>
              <span className="text-[13px] font-medium text-cy-text">Energy (kWh/mo)</span>
            </div>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_AMBER} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_AMBER} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="users" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="energy" name="Energy (kWh)" stroke={CHART_AMBER} fill="url(#energyGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-right font-mono text-[11px] text-cy-muted">
              {projectionData[projectionData.length - 1].energy.toLocaleString()} kWh at 10k users
            </p>
          </GlowCard>
        </div>

        <p className="text-[12px] leading-[1.6] text-cy-muted">
          Estimates compare local inference vs. routing the same work through a US-average
          datacenter. Constants: {KWH_PER_CHAT} kWh/chat avoided, {LITERS_PER_KWH} L water/kWh,
          {' '}{CO2_PER_KWH} kg CO₂/kWh.
        </p>
      </section>

      {/* This device */}
      <GlowCard className="animate-fade-up delay-300" innerClassName="p-6">
        <h2 className="text-[15px] font-medium text-cy-text">Your node id</h2>
        <p className="mt-1 text-[13px] text-cy-secondary">
          This is auto-detected from the local cluster and used for credit attribution.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-md border border-cy-border bg-cy-inset px-3 py-2.5 font-mono text-[12px] text-cy-text">
            {selfId ?? 'Loading…'}
          </code>
          <button
            type="button"
            onClick={copyId}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-cy-border bg-cy-inset text-cy-secondary transition hover:text-cy-text"
          >
            {copied ? <Check size={14} className="text-cy-green" /> : <Copy size={14} />}
          </button>
        </div>
      </GlowCard>

      {/* Cluster */}
      <GlowCard innerClassName="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-medium text-cy-text">Cluster</h2>
          {instances && (
            <span className="rounded-full bg-cy-inset px-2.5 py-0.5 text-[11px] font-medium text-cy-muted">
              {Object.keys(instances).length} instance{Object.keys(instances).length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {stateError && (
          <p className="mt-4 rounded-md border border-cy-error/20 bg-cy-error-light px-4 py-3 text-[13px] text-cy-error">
            Couldn't reach the cluster. Is the inference stack running on port 52415?
          </p>
        )}
        {!stateError && clusterRows.length === 0 && (
          <p className="mt-6 text-[14px] text-cy-muted">
            Start the inference stack on this network.
          </p>
        )}
        {clusterRows.length > 0 && (
          <ul className="mt-5 space-y-2">
            {clusterRows.map((row) => {
              const pct = usagePercent(row.used, row.total)
              return (
                <li key={row.id} className="rounded-lg border border-cy-border bg-cy-inset p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-cy-green opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cy-green" />
                      </span>
                      <span className="text-[14px] font-medium text-cy-text">{row.name}</span>
                    </div>
                    <span className="font-mono text-[12px] text-cy-secondary">
                      {formatBytes(row.used)} / {formatBytes(row.total)}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-cy-border">
                    <div
                      className="h-full rounded-full bg-cy-green transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 font-mono text-[10px] text-cy-muted">{row.id}</p>
                </li>
              )
            })}
          </ul>
        )}
      </GlowCard>

      {/* Active nodes */}
      <GlowCard innerClassName="p-6">
        <h2 className="text-[15px] font-medium text-cy-text">Active nodes</h2>
        <p className="mt-1 text-[13px] text-cy-secondary">Heartbeats in the last 90 seconds.</p>
        <ul className="mt-5 space-y-2">
          {nodes.length === 0 ? (
            <li className="text-[14px] text-cy-muted">None yet.</li>
          ) : (
            nodes.map((n) => (
              <li
                key={n.node_id}
                className="flex items-center justify-between rounded-lg border border-cy-border bg-cy-inset px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-cy-green opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-cy-green" />
                  </span>
                  <span className="text-[14px] text-cy-text">{n.label}</span>
                </div>
                <span className="font-mono text-[14px] font-semibold tabular-nums text-cy-green">
                  <AnimatedNumber value={n.balance} formatFn={(v) => Math.round(v).toString()} />
                </span>
              </li>
            ))
          )}
        </ul>
      </GlowCard>
    </div>
  )
}
