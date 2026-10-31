import { addMonthsISO } from './dates'

export const MIN_INSTALLMENTS = 2
export const MAX_INSTALLMENTS = 60

/**
 * Divide o total em N parcelas (centavos). A diferença de arredondamento vai para a 1ª.
 * Retorna null se não for possível (cada parcela precisa de ao menos 1 centavo).
 */
export function splitAmount(totalCents: number, n: number): number[] | null {
  if (!Number.isSafeInteger(totalCents) || !Number.isInteger(n) || n < 1 || totalCents < n) return null
  const base = Math.floor(totalCents / n)
  const parts = Array<number>(n).fill(base)
  parts[0] += totalCents - base * n
  return parts
}

/** Data de cada parcela: compra + (i−1) meses, último dia do mês se o dia não existir. */
export function installmentDates(purchaseDate: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonthsISO(purchaseDate, i))
}
