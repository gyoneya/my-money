// Regras puras das contas recorrentes (aluguel, assinaturas, salário).
import { addMonthsISO, monthKey } from './dates'
import { monthRange } from './analysis'

/** Quantos meses à frente (incluindo o atual) ficam sempre previstos. */
export const HORIZON_MONTHS = 12

/** Data da ocorrência no mês; dia inexistente (ex.: 31 em fevereiro) vira o último dia. */
export function occurrenceDate(month: string, day: number): string {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`
}

/**
 * Primeiro mês de uma regra nova: o atual se o dia ainda não passou, senão o próximo
 * (evita duplicar o que provavelmente já foi lançado à mão este mês).
 */
export function firstMonthFor(day: number, today: string): string {
  const current = monthKey(today)
  return occurrenceDate(current, day) >= today ? current : monthKey(addMonthsISO(`${current}-01`, 1))
}

/** Meses em que a regra deve ter lançamento: do início até o horizonte (ou o fim da regra). */
export function ruleMonths(
  rule: { start_month: string; end_month: string | null },
  today: string,
  horizon: number = HORIZON_MONTHS,
): string[] {
  const start = monthKey(rule.start_month)
  const lastByHorizon = monthKey(addMonthsISO(`${monthKey(today)}-01`, horizon - 1))
  const last = rule.end_month && monthKey(rule.end_month) < lastByHorizon ? monthKey(rule.end_month) : lastByHorizon
  if (start > last) return []
  const [sy, sm] = start.split('-').map(Number)
  const [ly, lm] = last.split('-').map(Number)
  return monthRange(start, (ly - sy) * 12 + (lm - sm) + 1)
}

/**
 * Id determinístico do lançamento de uma regra num mês (UUID v5-like via SHA-1).
 * Dois aparelhos gerando o mesmo mês produzem o mesmo id: o sync não duplica.
 */
export async function instanceId(ruleId: string, month: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${ruleId}:${month}`)))
  const b = digest.slice(0, 16)
  b[6] = (b[6] & 0x0f) | 0x50 // versão 5
  b[8] = (b[8] & 0x3f) | 0x80 // variante RFC 4122
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
