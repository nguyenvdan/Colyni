import { useCallback, useEffect, useState } from 'react'

import {
  MACHINE_ROLE_CHANGED,
  getCoordinatorApiUrl,
  getLocalInferenceUrl,
  getMachineRole,
  type MachineRole,
} from '@/lib/machine-role'

export type MachineRoleSnapshot = {
  role: MachineRole
  coordinatorApiUrl: string
  localInferenceUrl: string
}

function readSnapshot(): MachineRoleSnapshot {
  return {
    role: getMachineRole(),
    coordinatorApiUrl: getCoordinatorApiUrl(),
    localInferenceUrl: getLocalInferenceUrl(),
  }
}

export function useMachineRole(): MachineRoleSnapshot {
  const [snap, setSnap] = useState(readSnapshot)

  const sync = useCallback(() => {
    setSnap(readSnapshot())
  }, [])

  useEffect(() => {
    window.addEventListener(MACHINE_ROLE_CHANGED, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(MACHINE_ROLE_CHANGED, sync)
      window.removeEventListener('storage', sync)
    }
  }, [sync])

  return snap
}
