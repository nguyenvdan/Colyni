import { useCallback, useEffect, useState } from 'react'

import { FAVORITE_MODELS_CHANGED, getFavoriteModelIds } from '@/lib/favorite-models'

/** Subscribes to favorite model ids in localStorage (same tab + other tabs). */
export function useFavoriteModelIds(): string[] {
  const [ids, setIds] = useState(getFavoriteModelIds)

  const sync = useCallback(() => {
    setIds(getFavoriteModelIds())
  }, [])

  useEffect(() => {
    window.addEventListener(FAVORITE_MODELS_CHANGED, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(FAVORITE_MODELS_CHANGED, sync)
      window.removeEventListener('storage', sync)
    }
  }, [sync])

  return ids
}
