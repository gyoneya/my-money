import type { Session } from '@supabase/supabase-js'
import { lazy, Suspense, useEffect, useState } from 'react'
import { bootstrap } from './bootstrap'
import { supabase } from './lib/supabase'
import { LaunchScreen } from './screens/LaunchScreen'
import { ConfigScreen } from './screens/ConfigScreen'
import { LoginScreen } from './screens/LoginScreen'
import { StatementScreen, type StatementFilter } from './screens/StatementScreen'

// Análise (e os gráficos) só carrega quando a aba é aberta: a tela Lançar continua leve.
const AnalysisScreen = lazy(() => import('./screens/AnalysisScreen').then((m) => ({ default: m.AnalysisScreen })))
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
  const [statementFilter, setStatementFilter] = useState<StatementFilter | null>(null)
  useEffect(() => startSync(), [])

  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'lancar' ? (
          <LaunchScreen />
        ) : tab === 'extrato' ? (
          <StatementScreen
            key={statementFilter ? `${statementFilter.categoryId}:${statementFilter.month}` : 'all'}
            filter={statementFilter}
            onClearFilter={() => setStatementFilter(null)}
          />
        ) : tab === 'analise' ? (
          <Suspense fallback={null}>
            <AnalysisScreen
              onOpenCategory={(categoryId, month) => {
                setStatementFilter({ categoryId, month })
                setTab('extrato')
              }}
            />
          </Suspense>
        ) : (
          <ConfigScreen />
        )}
      </main>
      <nav
        className="grid grid-cols-4 border-t border-line bg-bg"
        // iPhone: invade parte da área da barra de gestos (34px) para ganhar espaço,
        // mantendo os rótulos acima do traço inferior.
        style={{ paddingBottom: 'max(calc(env(safe-area-inset-bottom) - 20px), 4px)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setStatementFilter(null)
              setTab(t.id)
            }}
            className={`flex flex-col items-center gap-0.5 pt-2 pb-1 text-xs ${
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
