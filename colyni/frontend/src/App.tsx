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

  const [joinWelcomeBanner, setJoinWelcomeBanner] = useState(
    () => typeof window !== 'undefined' && window.__COLYNI_INVITE_APPLIED__ === true,
  )

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

      {joinWelcomeBanner && (
        <div className="mx-auto max-w-[1100px] px-6 pt-2 md:px-12" role="status">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cy-green/35 bg-cy-green-light px-4 py-3 text-[13px] text-cy-secondary">
            <p>
              <span className="font-semibold text-cy-text">You joined a friend&apos;s room</span>
              {' — '}
              This browser talks to their computer. On this Mac, keep the contributor script running
              (the one from the install instructions) so you can help run the AI.
            </p>
            <button
              type="button"
              onClick={() => {
                setJoinWelcomeBanner(false)
                window.__COLYNI_INVITE_APPLIED__ = false
              }}
              className="shrink-0 rounded-lg border border-cy-border bg-cy-surface px-3 py-1.5 text-[12px] font-medium text-cy-text hover:bg-cy-inset"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main>
        {tab !== 'home' && <RoleBanner />}
        {tab === 'home' && (
          <HomePage
            onGoChat={() => setTab('chat')}
            onGoContribute={() => setTab('contribute')}
            onGoSettings={() => setTab('settings')}
          />
        )}
        {tab === 'chat' && (
          <div className="mx-auto max-w-[1100px] px-6 pb-[max(10rem,env(safe-area-inset-bottom)+7rem)] pt-10 md:px-12 sm:pb-32">
            <ChatPage
              nodeId={nodeId}
              onNodeIdChange={persistNodeId}
              label={label}
              onLabelChange={persistLabel}
            />
          </div>
        )}
        {tab === 'contribute' && (
          <div className="mx-auto max-w-[1100px] px-6 pb-[max(10rem,env(safe-area-inset-bottom)+7rem)] pt-10 md:px-12 sm:pb-32">
            <ContributePage />
          </div>
        )}
        {tab === 'settings' && (
          <div className="mx-auto max-w-[1100px] px-6 pb-[max(10rem,env(safe-area-inset-bottom)+7rem)] pt-10 md:px-12 sm:pb-32">
            <SettingsPage nodeId={nodeId} onNodeIdChange={persistNodeId} />
          </div>
        )}
      </main>

      {/* Extra scroll room so content clears the fixed bottom nav on phones */}
      <div className="h-24 shrink-0 sm:hidden" aria-hidden />
    </div>
  )
}
