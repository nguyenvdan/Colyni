const STORAGE_KEY = 'colyni-favorite-model-ids'

/** Dispatched on same-tab updates; `storage` handles other tabs. */
export const FAVORITE_MODELS_CHANGED = 'colyni-favorites-changed'

export function getFavoriteModelIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.filter((x): x is string => typeof x === 'string'))]
  } catch {
    return []
  }
}

export function setFavoriteModelIds(ids: string[]) {
  const uniq = [...new Set(ids)]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uniq))
  window.dispatchEvent(new CustomEvent(FAVORITE_MODELS_CHANGED))
}

export function toggleFavoriteModelId(id: string) {
  const cur = getFavoriteModelIds()
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
  setFavoriteModelIds(next)
}
