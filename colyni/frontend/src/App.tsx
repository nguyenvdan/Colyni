import { useCallback, useEffect, useState } from 'react'
import { Home, MessageSquare, Cpu, Settings } from 'lucide-react'

import { RoleBanner } from '@/components/role-banner'
import { apiUrl } from '@/lib/api'
import { useMachineRole } from '@/hooks/use-machine-role'
import { NavBar, type NavItem } from '@/components/ui/tubelight-navbar'
import { ChatPage } from '@/pages/ChatPage'
import { ContributePage } from '@/pages/ContributePage'
import { HomePage } from '@/pages/HomePage'
import { SettingsPage } from '@/pages/SettingsPage'

const STORAGE_NODE = 'colyni-node-id'
const STORAGE_LABEL = 'colyni-label'

export type AppTab = 'home' | 'chat' | 'contribute' | 'settings'

const NAV_ITEMS: NavItem[] = [
  { name: 'Home', id: 'home', icon: Home },
  { name: 'Chat', id: 'chat', icon: MessageSquare },
  { name: 'Contribute', id: 'contribute', icon: Cpu },
  { name: 'Settings', id: 'settings', icon: Settings },
]

export default function App() {
  const machine = useMachineRole()
  const [tab, setTab] = useState<AppTab>('home')
  const [nodeId, setNodeId] = useState(
    () => localStorage.getItem(STORAGE_NODE) ?? '',
  )
  const [label, setLabel] = useState(
    () => localStorage.getItem(STORAGE_LABEL) ?? '',
  )

  const persistNodeId = useCallback((id: string) => {
    setNodeId(id)
    localStorage.setItem(STORAGE_NODE, id)
  }, [])

  const persistLabel = useCallback((v: string) => {
    setLabel(v)
    localStorage.setItem(STORAGE_LABEL, v)
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        if (machine.role === 'contributor') {
          const base = machine.localInferenceUrl.replace(/\/$/, '')
          const r = await fetch(`${base}/node_id`)
          if (r.ok) {
            const text = await r.text()
            const id = text.trim().replace(/^"|"$/g, '')
            if (id) persistNodeId(id)
          }
          return
        }
        const r = await fetch(apiUrl('/api/cluster/self-id'))
        if (!r.ok) return
        const text = await r.text()
        const id = text.trim().replace(/^"|"$/g, '')
        if (id) persistNodeId(id)
      } catch {
        /* cluster not running yet */
      }
    })()
  }, [machine.role, machine.coordinatorApiUrl, machine.localInferenceUrl, persistNodeId])

  return (
    <div className="min-h-svh bg-cy-bg font-sans text-cy-text antialiased">
      <NavBar
        items={NAV_ITEMS}
        activeTab={tab}
        onTabChange={(id) => setTab(id as AppTab)}
      />

      {/* spacer for fixed navbar */}
      <div className="hidden h-20 sm:block" />

      <main>
        {tab !== 'home' && <RoleBanner />}
        {tab === 'home' && (
          <HomePage
            onGoChat={() => setTab('chat')}
            onGoContribute={() => setTab('contribute')}
          />
        )}
        {tab === 'chat' && (
          <div className="mx-auto max-w-[1100px] px-6 pb-28 pt-10 md:px-12">
            <ChatPage
              nodeId={nodeId}
              onNodeIdChange={persistNodeId}
              label={label}
              onLabelChange={persistLabel}
            />
          </div>
        )}
        {tab === 'contribute' && (
          <div className="mx-auto max-w-[1100px] px-6 pb-28 pt-10 md:px-12">
            <ContributePage />
          </div>
        )}
        {tab === 'settings' && (
          <div className="mx-auto max-w-[1100px] px-6 pb-28 pt-10 md:px-12">
            <SettingsPage nodeId={nodeId} onNodeIdChange={persistNodeId} />
          </div>
        )}
      </main>

      {/* spacer for mobile bottom nav */}
      <div className="h-20 sm:hidden" />
    </div>
  )
}
