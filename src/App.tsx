import { useEffect, useState } from 'react'
import { seedCategoriesIfEmpty } from './db/repo'
import { LaunchScreen } from './screens/LaunchScreen'
import { DEFAULT_TAB, TABS, type TabId } from './tabs'
import { TabIcon } from './TabIcon'

export default function App() {
  const [tab, setTab] = useState<TabId>(DEFAULT_TAB)
  const [ready, setReady] = useState(false)
  const current = TABS.find((t) => t.id === tab)!

  // Provisório até o login (etapa 8): categorias iniciais locais.
  useEffect(() => {
    seedCategoriesIfEmpty().finally(() => setReady(true))
  }, [])

  return (
    <div className="flex h-full flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto">
        {!ready ? null : tab === 'lancar' ? (
          <LaunchScreen />
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
