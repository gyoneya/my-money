import { useState } from 'react'
import { DEFAULT_TAB, TABS, type TabId } from './tabs'

export default function App() {
  const [tab, setTab] = useState<TabId>(DEFAULT_TAB)
  const current = TABS.find((t) => t.id === tab)!

  return (
    <div className="flex h-full flex-col">
      <main className="flex flex-1 items-center justify-center overflow-y-auto p-4">
        <p className="text-slate-400">{current.label} — em construção</p>
      </main>
      <nav
        className="grid grid-cols-4 border-t border-slate-800 bg-slate-900"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-0.5 py-2 text-xs ${
              t.id === tab ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            <span className="text-lg" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
