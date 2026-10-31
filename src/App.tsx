import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { bootstrap } from './bootstrap'
import { supabase } from './lib/supabase'
import { LaunchScreen } from './screens/LaunchScreen'
import { ConfigScreen } from './screens/ConfigScreen'
import { LoginScreen } from './screens/LoginScreen'
import { StatementScreen } from './screens/StatementScreen'
import { startSync } from './sync/manager'
import { DEFAULT_TAB, TABS, type TabId } from './tabs'
import { TabIcon } from './TabIcon'

export default function App() {
  // undefined = ainda lendo a sessão salva no aparelho
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [readyFor, setReadyFor] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) return
    let alive = true
    bootstrap(userId)
      .catch((e) => console.error('bootstrap', e))
      .finally(() => alive && setReadyFor(userId))
    return () => {
      alive = false
    }
  }, [userId])

  if (session === undefined) return null
  if (!session) return <LoginScreen />
  if (readyFor !== userId) return null
  return <MainApp />
}

function MainApp() {
  const [tab, setTab] = useState<TabId>(DEFAULT_TAB)
  useEffect(() => startSync(), [])
  const current = TABS.find((t) => t.id === tab)!

  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'lancar' ? (
          <LaunchScreen />
        ) : tab === 'extrato' ? (
          <StatementScreen />
        ) : tab === 'config' ? (
          <ConfigScreen />
        ) : (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-muted">{current.label} — em construção</p>
          </div>
        )}
      </main>
      <nav
        className="grid grid-cols-4 border-t border-line bg-bg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
              t.id === tab ? 'text-brand' : 'text-muted'
            }`}
          >
            <TabIcon id={t.id} />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
