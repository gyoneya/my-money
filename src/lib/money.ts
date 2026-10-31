// Valores sempre em centavos inteiros. Nunca float.

/** Maior valor aceito por lançamento: R$ 9.999.999,99. */
export const MAX_CENTS = 999_999_999

/**
 * Entrada estilo banco: cada dígito entra pela direita.
 * `1 2 3 4` → 1234 centavos (R$ 12,34). Dígito que estouraria o teto é ignorado.
 */
export function pressKey(cents: number, key: string): number {
  if (key === 'back') return Math.floor(cents / 10)
  if (!/^\d{1,2}$/.test(key)) return cents
  const next = cents * 10 ** key.length + Number(key)
  return next > MAX_CENTS ? cents : next
}

/** `R$ 1.234,56`; negativos como `-R$ 1.234,56`. */
export function formatBRL(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(cents))
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const cent = (abs % 100).toString().padStart(2, '0')
  return `${sign}R$ ${reais},${cent}`
}

/**
 * Lê um valor digitado livremente (fallback de acessibilidade).
 * Aceita `12`, `12,3`, `12,34`, `1.234,56`, `R$ 1.234,56`, `12.34`.
 * Retorna centavos ou `null` se inválido, zero/negativo ou acima do teto.
 */
export function parseBRL(input: string): number | null {
  let s = input.replace(/R\$/i, '').replace(/\s/g, '')
  if (!s) return null

  if (s.includes(',')) {
    // Vírgula é decimal; pontos são milhar.
    if (!/^\d{1,3}(\.\d{3})*(,\d{0,2})?$|^\d+(,\d{0,2})?$/.test(s)) return null
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d+\.\d{1,2}$/.test(s)) {
    // Um único ponto com 1–2 casas: decimal (ex.: teclado em inglês).
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  } else if (!/^\d+$/.test(s)) {
    return null
  }

  const [int, dec = ''] = s.split('.')
  const cents = Number(int) * 100 + Number(dec.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) return null
  return cents
}
