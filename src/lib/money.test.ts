import { describe, expect, it } from 'vitest'
import { formatBRL, MAX_CENTS, parseBRL, pressKey } from './money'

const type = (keys: string[], start = 0) => keys.reduce(pressKey, start)

describe('pressKey (entrada estilo banco)', () => {
  it('1 2 3 4 → R$ 12,34', () => {
    expect(type(['1', '2', '3', '4'])).toBe(1234)
  })

  it('00 multiplica por 100', () => {
    expect(type(['5', '00'])).toBe(500)
  })

  it('zeros à esquerda não contam', () => {
    expect(type(['0', '0', '7'])).toBe(7)
  })

  it('apagar remove o último dígito', () => {
    expect(type(['1', '2', '3', 'back'])).toBe(12)
    expect(type(['back'])).toBe(0)
  })

  it('ignora dígito que estoura o teto', () => {
    expect(pressKey(MAX_CENTS, '9')).toBe(MAX_CENTS)
    expect(pressKey(99_999_999, '00')).toBe(99_999_999)
    expect(pressKey(99_999_999, '9')).toBe(MAX_CENTS)
  })

  it('ignora teclas inválidas', () => {
    expect(pressKey(12, 'x')).toBe(12)
    expect(pressKey(12, '000')).toBe(12)
  })
})

describe('formatBRL', () => {
  it.each([
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [1234, 'R$ 12,34'],
    [123456, 'R$ 1.234,56'],
    [MAX_CENTS, 'R$ 9.999.999,99'],
    [-1234, '-R$ 12,34'],
    [-100000, '-R$ 1.000,00'],
  ])('%i → %s', (cents, text) => {
    expect(formatBRL(cents)).toBe(text)
  })
})

describe('parseBRL', () => {
  it.each([
    ['12', 1200],
    ['12,3', 1230],
    ['12,34', 1234],
    ['12,', 1200],
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['R$ 1.234,56', 123456],
    ['12.34', 1234],
    ['1.234', 123400],
    [' 0,01 ', 1],
  ])('%s → %i', (text, cents) => {
    expect(parseBRL(text)).toBe(cents)
  })

  it.each(['', 'abc', '0', '0,00', '-5', '12,345', '1,2,3', '12.3.4', '10.000.000,00'])(
    'rejeita %s',
    (text) => {
      expect(parseBRL(text)).toBeNull()
    },
  )
})
