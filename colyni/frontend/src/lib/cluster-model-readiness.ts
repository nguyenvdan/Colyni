/**
 * Parse colyni-cluster /state JSON (camelCase + tagged runner statuses like { RunnerLoading: {...} }).
 */

export function getTaggedVariant(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null
  const keys = Object.keys(obj as Record<string, unknown>)
  if (keys.length !== 1) return null
  return keys[0] ?? null
}

export function getTaggedPayload(obj: unknown): Record<string, unknown> | null {
  const v = getTaggedVariant(obj)
  if (!v) return null
  const inner = (obj as Record<string, unknown>)[v]
  return inner && typeof inner === 'object' ? (inner as Record<string, unknown>) : null
}

function normModelId(a: string, b: string): boolean {
  return a.trim() === b.trim()
}

function memoryBytes(mem: unknown): number {
  if (!mem || typeof mem !== 'object') return 0
  const o = mem as Record<string, unknown>
  return Number(o.inBytes ?? o.in_bytes ?? 0)
}

/** Best-effort: HF download progress for this model from state.downloads (often dominates load time). */
export function downloadProgressSummary(
  state: Record<string, unknown>,
  modelId: string,
): string | null {
  const want = modelId.trim()
  const raw = state.downloads ?? state.Downloads
  if (!raw || typeof raw !== 'object') return null

  let bestPct = -1
  let best: string | null = null

  for (const nodeList of Object.values(raw as Record<string, unknown>)) {
    if (!Array.isArray(nodeList)) continue
    for (const item of nodeList) {
      if (!item || typeof item !== 'object') continue
      const tag = getTaggedVariant(item)
      if (tag !== 'DownloadOngoing') continue
      const payload = getTaggedPayload(item)
      if (!payload) continue
      const hay = JSON.stringify(payload)
      if (!hay.includes(`"modelId":"${want}"`) && !hay.includes(`"model_id":"${want}"`)) continue

      const dp = (payload.downloadProgress ?? payload.download_progress) as
        | Record<string, unknown>
        | undefined
      if (!dp || typeof dp !== 'object') continue

      const down = memoryBytes(dp.downloaded ?? dp.Downloaded)
      const tot = memoryBytes(dp.total ?? dp.Total)
      const etaMs = Number(dp.etaMs ?? dp.eta_ms ?? 0)
      if (tot <= 0) {
        const line = 'Downloading model files (preparing transfer)…'
        if (bestPct < 0) best = line
        continue
      }
      const pct = Math.min(100, Math.round((down / tot) * 100))
      const gb = (b: number) => (b / 1024 ** 3).toFixed(2)
      const downGb = gb(down)
      const totGb = gb(tot)
      let line = `Downloading model files ${pct}% (${downGb} / ${totGb} GB)`
      if (etaMs > 5000) line += ` · ~${Math.max(1, Math.round(etaMs / 60000))} min left`
      if (pct > bestPct) {
        bestPct = pct
        best = line
      }
    }
  }
  return best
}

export function countComputersForInstance(instance: Record<string, unknown>): number {
  const sa = (instance.shardAssignments ?? instance.shard_assignments) as
    | Record<string, unknown>
    | undefined
  if (!sa) return 0
  const n2r = (sa.nodeToRunner ?? sa.node_to_runner) as Record<string, string> | undefined
  if (!n2r) return 0
  return Object.keys(n2r).length
}

/** Best-effort layer progress across runners for this instance (pick furthest along). */
export function layerProgressLine(
  state: Record<string, unknown>,
  instance: Record<string, unknown>,
): string | null {
  const sa = (instance.shardAssignments ?? instance.shard_assignments) as
    | Record<string, unknown>
    | undefined
  if (!sa) return null
  const n2r = (sa.nodeToRunner ?? sa.node_to_runner) as Record<string, string> | undefined
  if (!n2r) return null
  const runners = (state.runners ?? state.Runners) as Record<string, unknown> | undefined
  if (!runners) return null
  let bestCur = 0
  let bestTot = 0
  for (const rid of new Set(Object.values(n2r))) {
    const st = runners[rid]
    const tag = getTaggedVariant(st)
    if (tag !== 'RunnerLoading') continue
    const p = getTaggedPayload(st)
    if (!p) continue
    const cur = Number(p.layersLoaded ?? p.layers_loaded ?? 0)
    const tot = Number(p.totalLayers ?? p.total_layers ?? 0)
    if (tot <= 0) continue
    if (bestTot === 0 || cur / tot > bestCur / bestTot) {
      bestCur = cur
      bestTot = tot
    }
  }
  if (bestTot > 0) return `Loading model layers ${bestCur} / ${bestTot}…`
  return null
}

function runnersReadyForInstance(state: Record<string, unknown>, instance: Record<string, unknown>): boolean {
  const sa = (instance.shardAssignments ?? instance.shard_assignments) as
    | Record<string, unknown>
    | undefined
  if (!sa) return false
  const n2r = (sa.nodeToRunner ?? sa.node_to_runner) as Record<string, string> | undefined
  if (!n2r || Object.keys(n2r).length === 0) return false
  const runners = (state.runners ?? state.Runners) as Record<string, unknown> | undefined
  if (!runners) return false
  const ids = [...new Set(Object.values(n2r))]
  /** WarmingUp often means weights are loaded; chat may work — avoids 5+ min extra wait if tags lag. */
  const ok = new Set([
    'RunnerReady',
    'RunnerRunning',
    'RunnerLoaded',
    'RunnerWarmingUp',
  ])
  for (const rid of ids) {
    const st = runners[rid]
    const tag = getTaggedVariant(st)
    if (!tag || !ok.has(tag)) return false
  }
  return true
}

export function findInstanceForModel(
  state: Record<string, unknown>,
  modelId: string,
): Record<string, unknown> | null {
  const raw = state.instances ?? state.Instances
  if (!raw || typeof raw !== 'object') return null
  for (const inst of Object.values(raw)) {
    if (!inst || typeof inst !== 'object') continue
    // Instances may be wrapped in a tagged variant (e.g. { MlxRingInstance: {...} })
    const o = (getTaggedPayload(inst) ?? inst) as Record<string, unknown>
    const sa = (o.shardAssignments ?? o.shard_assignments) as Record<string, unknown> | undefined
    if (!sa) continue
    const mid = String(sa.modelId ?? sa.model_id ?? '')
    if (normModelId(mid, modelId)) return o
  }
  return null
}

export function isModelReadyOnCluster(state: Record<string, unknown>, modelId: string): boolean {
  const inst = findInstanceForModel(state, modelId)
  if (!inst) return false
  return runnersReadyForInstance(state, inst)
}

export function describeLoadStatus(
  state: Record<string, unknown>,
  modelId: string,
): {
  computers: number
  layerLine: string | null
  downloadLine: string | null
  downloadPct: number | null
  layerPct: number | null
  ready: boolean
} {
  const inst = findInstanceForModel(state, modelId)
  const downloadLine = downloadProgressSummary(state, modelId)
  const downloadPct = downloadProgressPct(state, modelId)
  if (!inst) {
    return { computers: 0, layerLine: null, downloadLine, downloadPct, layerPct: null, ready: false }
  }
  const computers = countComputersForInstance(inst)
  const ready = runnersReadyForInstance(state, inst)
  const layerLine = ready ? null : layerProgressLine(state, inst)
  const layerPct = ready ? null : layerProgressPct(state, inst)
  return { computers, layerLine, downloadLine, downloadPct, layerPct, ready }
}

function downloadProgressPct(state: Record<string, unknown>, modelId: string): number | null {
  const want = modelId.trim()
  const raw = state.downloads ?? state.Downloads
  if (!raw || typeof raw !== 'object') return null
  let best: number | null = null
  for (const nodeList of Object.values(raw as Record<string, unknown>)) {
    if (!Array.isArray(nodeList)) continue
    for (const item of nodeList) {
      if (!item || typeof item !== 'object') continue
      const tag = getTaggedVariant(item)
      if (tag !== 'DownloadOngoing') continue
      const payload = getTaggedPayload(item)
      if (!payload) continue
      const hay = JSON.stringify(payload)
      if (!hay.includes(`"modelId":"${want}"`) && !hay.includes(`"model_id":"${want}"`)) continue
      const dp = (payload.downloadProgress ?? payload.download_progress) as Record<string, unknown> | undefined
      if (!dp || typeof dp !== 'object') continue
      const down = memoryBytes(dp.downloaded ?? dp.Downloaded)
      const tot = memoryBytes(dp.total ?? dp.Total)
      if (tot <= 0) continue
      const pct = Math.min(100, Math.round((down / tot) * 100))
      if (best === null || pct > best) best = pct
    }
  }
  return best
}

function layerProgressPct(state: Record<string, unknown>, instance: Record<string, unknown>): number | null {
  const sa = (instance.shardAssignments ?? instance.shard_assignments) as Record<string, unknown> | undefined
  if (!sa) return null
  const n2r = (sa.nodeToRunner ?? sa.node_to_runner) as Record<string, string> | undefined
  if (!n2r) return null
  const runners = (state.runners ?? state.Runners) as Record<string, unknown> | undefined
  if (!runners) return null
  let bestPct: number | null = null
  for (const rid of new Set(Object.values(n2r))) {
    const st = runners[rid]
    const tag = getTaggedVariant(st)
    if (tag !== 'RunnerLoading') continue
    const p = getTaggedPayload(st)
    if (!p) continue
    const cur = Number(p.layersLoaded ?? p.layers_loaded ?? 0)
    const tot = Number(p.totalLayers ?? p.total_layers ?? 0)
    if (tot <= 0) continue
    const pct = Math.round((cur / tot) * 100)
    if (bestPct === null || pct > bestPct) bestPct = pct
  }
  return bestPct
}

export type ClusterSummary = {
  nodeCount: number
  totalMemoryGb: number
  availMemoryGb: number
  nodes: { id: string; name: string; totalGb: number; availGb: number }[]
}

export function clusterSummary(state: Record<string, unknown>): ClusterSummary {
  const ni = (state.nodeIdentities ?? state.node_identities ?? {}) as Record<string, Record<string, unknown>>
  const nm = (state.nodeMemory ?? state.node_memory ?? {}) as Record<string, Record<string, unknown>>
  const ids = new Set([...Object.keys(ni), ...Object.keys(nm)])

  const nodes: ClusterSummary['nodes'] = []
  let totalMem = 0
  let availMem = 0

  for (const id of ids) {
    const info = ni[id]
    const mem = nm[id]
    const ramTotal = mem?.ramTotal ?? mem?.ram_total
    const ramAvail = mem?.ramAvailable ?? mem?.ram_available
    const tb = memoryBytes(ramTotal)
    const ab = memoryBytes(ramAvail)
    totalMem += tb
    availMem += ab
    const friendlyName = info?.friendlyName as string | undefined
    const name = friendlyName && friendlyName !== 'Unknown'
      ? friendlyName
      : `${id.slice(0, 12)}…`
    nodes.push({ id, name, totalGb: tb / 1024 ** 3, availGb: ab / 1024 ** 3 })
  }

  return {
    nodeCount: ids.size,
    totalMemoryGb: totalMem / 1024 ** 3,
    availMemoryGb: availMem / 1024 ** 3,
    nodes,
  }
}
