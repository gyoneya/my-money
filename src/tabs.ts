export type TabId = 'lancar' | 'extrato' | 'analise' | 'config'

export const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'lancar', label: 'Lançar', icon: '➕' },
  { id: 'extrato', label: 'Extrato', icon: '📄' },
  { id: 'analise', label: 'Análise', icon: '📊' },
  { id: 'config', label: 'Config', icon: '⚙️' },
]

// App abre sempre na tela de lançamento.
export const DEFAULT_TAB: TabId = 'lancar'
