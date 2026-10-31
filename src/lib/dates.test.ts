import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  addMonthsISO,
  formatDateBR,
  formatDayHeader,
  formatMonthLabel,
  monthKey,
  relativeDayLabel,
  todayISO,
} from './dates'

describe('todayISO (fuso São Paulo)', () => {
  it('00:30 UTC ainda é o dia anterior em SP', () => {
    expect(todayISO(new Date('2026-11-01T00:30:00Z'))).toBe('2026-10-31')
  })

  it('03:00 UTC já é o dia seguinte em SP', () => {
    expect(todayISO(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-01')
  })
})

describe('addDaysISO', () => {
  it('atravessa mês e ano', () => {
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysISO('2028-03-01', -1)).toBe('2028-02-29')
  })
})

describe('addMonthsISO (fim de mês)', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2028-01-31', 1, '2028-02-29'],
    ['2026-01-31', 2, '2026-03-31'],
    ['2026-01-31', 3, '2026-04-30'],
    ['2026-03-30', 11, '2027-02-28'],
    ['2026-10-15', 3, '2027-01-15'],
    ['2026-10-15', 0, '2026-10-15'],
    ['2026-01-15', -1, '2025-12-15'],
  ])('%s + %i meses = %s', (iso, n, expected) => {
    expect(addMonthsISO(iso, n)).toBe(expected)
  })
})

describe('formatação pt-BR', () => {
  it('dd/mm/aaaa', () => {
    expect(formatDateBR('2026-01-05')).toBe('05/01/2026')
  })

  it('mês', () => {
    expect(monthKey('2026-10-31')).toBe('2026-10')
    expect(formatMonthLabel('2026-10')).toBe('outubro de 2026')
  })

  it('cabeçalho do dia', () => {
    expect(formatDayHeader('2026-10-31')).toBe('sábado, 31 de outubro')
  })

  it('rótulo relativo', () => {
    const today = '2026-10-31'
    expect(relativeDayLabel('2026-10-31', today)).toBe('Hoje')
    expect(relativeDayLabel('2026-10-30', today)).toBe('Ontem')
    expect(relativeDayLabel('2026-10-29', today)).toBe('Anteontem')
    expect(relativeDayLabel('2026-10-28', today)).toBe('28/10/2026')
  })
})
