import { describe, expect, it } from 'vitest'
import { installmentDates, splitAmount } from './installments'

describe('splitAmount', () => {
  it('divisão exata', () => {
    expect(splitAmount(120000, 10)).toEqual(Array(10).fill(12000))
  })

  it('resto do arredondamento vai para a 1ª parcela', () => {
    expect(splitAmount(10000, 3)).toEqual([3334, 3333, 3333])
    expect(splitAmount(1001, 4)).toEqual([251, 250, 250, 250])
  })

  it('soma sempre igual ao total', () => {
    for (const [total, n] of [[99999, 7], [12345, 24], [5, 5], [100, 24]]) {
      const parts = splitAmount(total, n)!
      expect(parts).toHaveLength(n)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
      expect(Math.min(...parts)).toBeGreaterThanOrEqual(1)
    }
  })

  it('1x = valor cheio', () => {
    expect(splitAmount(500, 1)).toEqual([500])
  })

  it('impossível quando o total tem menos centavos que parcelas', () => {
    expect(splitAmount(3, 4)).toBeNull()
    expect(splitAmount(0, 2)).toBeNull()
  })
})

describe('installmentDates', () => {
  it('mensal a partir da data da compra', () => {
    expect(installmentDates('2026-10-15', 3)).toEqual(['2026-10-15', '2026-11-15', '2026-12-15'])
  })

  it('fim de mês usa o último dia sem "escorregar"', () => {
    expect(installmentDates('2026-01-31', 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('atravessa o ano', () => {
    expect(installmentDates('2026-11-30', 4)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30', '2027-02-28'])
  })
})
