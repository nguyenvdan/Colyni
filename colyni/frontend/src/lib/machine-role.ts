/**
 * Who runs the LLM vs who only joins the cluster.
 * Contributor mode sends all Colyni API traffic to another Mac's backend (port 8787).
 */

export type MachineRole = 'coordinator' | 'contributor'

const ROLE_KEY = 'colyni-machine-role'
const COORDINATOR_API_KEY = 'colyni-coordinator-api-url'
const LOCAL_INFERENCE_KEY = 'colyni-local-inference-url'

export const MACHINE_ROLE_CHANGED = 'colyni-machine-role-changed'

const DEFAULT_LOCAL_INFERENCE = 'http://127.0.0.1:52415'

export function getMachineRole(): MachineRole {
  try {
    const v = localStorage.getItem(ROLE_KEY)
    if (v === 'contributor') return 'contributor'
  } catch {
    /* ignore */
  }
  return 'coordinator'
}

export function setMachineRole(role: MachineRole) {
  localStorage.setItem(ROLE_KEY, role)
  window.dispatchEvent(new CustomEvent(MACHINE_ROLE_CHANGED))
}

export function getCoordinatorApiUrl(): string {
  try {
    return (localStorage.getItem(COORDINATOR_API_KEY) ?? '').trim()
  } catch {
    return ''
  }
}

export function setCoordinatorApiUrl(url: string) {
  localStorage.setItem(COORDINATOR_API_KEY, url.trim())
  window.dispatchEvent(new CustomEvent(MACHINE_ROLE_CHANGED))
}

export function getLocalInferenceUrl(): string {
  try {
    const u = (localStorage.getItem(LOCAL_INFERENCE_KEY) ?? '').trim()
    return u || DEFAULT_LOCAL_INFERENCE
  } catch {
    return DEFAULT_LOCAL_INFERENCE
  }
}

export function setLocalInferenceUrl(url: string) {
  localStorage.setItem(LOCAL_INFERENCE_KEY, url.trim())
  window.dispatchEvent(new CustomEvent(MACHINE_ROLE_CHANGED))
}

function normalizeOrigin(url: string): string {
  const t = url.trim().replace(/\/$/, '')
  if (!t) return ''
  try {
    const u = new URL(t.includes('://') ? t : `http://${t}`)
    return `${u.protocol}//${u.host}`
  } catch {
    return ''
  }
}

/** Returns normalized origin or empty if invalid. */
export function parseCoordinatorApiUrl(input: string): string {
  return normalizeOrigin(input)
}
