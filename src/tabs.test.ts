import { describe, expect, it } from 'vitest'
import { DEFAULT_TAB, TABS } from './tabs'

describe('abas', () => {
  it('abre na tela Lançar', () => {
    expect(DEFAULT_TAB).toBe('lancar')
  })

  it('tem as 4 abas na ordem da especificação', () => {
    expect(TABS.map((t) => t.label)).toEqual(['Lançar', 'Extrato', 'Análise', 'Config'])
  })
})
