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
  const ok = new Set(['RunnerReady', 'RunnerRunning', 'RunnerLoaded'])
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
    const o = inst as Record<string, unknown>
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
): { computers: number; layerLine: string | null; ready: boolean } {
  const inst = findInstanceForModel(state, modelId)
  if (!inst) {
    return { computers: 0, layerLine: null, ready: false }
  }
  const computers = countComputersForInstance(inst)
  const ready = runnersReadyForInstance(state, inst)
  const layerLine = ready ? null : layerProgressLine(state, inst)
  return { computers, layerLine, ready }
}
