export type TabId = 'lancar' | 'extrato' | 'analise' | 'config'

export const TABS: { id: TabId; label: string }[] = [
  { id: 'lancar', label: 'Lançar' },
  { id: 'extrato', label: 'Extrato' },
  { id: 'analise', label: 'Análise' },
  { id: 'config', label: 'Config' },
]

// App abre sempre na tela de lançamento.
export const DEFAULT_TAB: TabId = 'lancar'
