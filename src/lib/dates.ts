// Datas de calendário trafegam como string ISO `AAAA-MM-DD` (igual ao `date` do Postgres).
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const TIME_ZONE = 'America/Sao_Paulo'

const isoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Data de hoje em São Paulo, independente do fuso do aparelho. */
export function todayISO(now: Date = new Date()): string {
  return isoFormatter.format(now)
}

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

function toISO(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = parts(iso)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** Soma meses; se o dia não existir no mês de destino, usa o último dia. */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = parts(iso)
  const idx = y * 12 + (m - 1) + months
  const ny = Math.floor(idx / 12)
  const nm = (idx % 12) + 1
  return toISO(ny, nm, Math.min(d, daysInMonth(ny, nm)))
}

/** `AAAA-MM` do mês da data. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

/** `dd/mm/aaaa` */
export function formatDateBR(iso: string): string {
  const [y, m, d] = parts(iso)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

/** Hoje / Ontem / Anteontem, senão `dd/mm/aaaa`. */
export function relativeDayLabel(iso: string, today: string = todayISO()): string {
  if (iso === today) return 'Hoje'
  if (iso === addDaysISO(today, -1)) return 'Ontem'
  if (iso === addDaysISO(today, -2)) return 'Anteontem'
  return formatDateBR(iso)
}

function localDate(iso: string): Date {
  const [y, m, d] = parts(iso)
  return new Date(y, m - 1, d)
}

/** `sábado, 31 de outubro` */
export function formatDayHeader(iso: string): string {
  return format(localDate(iso), "EEEE, d 'de' MMMM", { locale: ptBR })
}

/** `out` (ou `out/27` quando `withYear`) a partir de `AAAA-MM`, para eixos de gráfico. */
export function formatMonthShort(month: string, withYear = false): string {
  const label = format(localDate(`${month}-01`), 'MMM', { locale: ptBR })
  return withYear ? `${label}/${month.slice(2, 4)}` : label
}

/** `outubro de 2026` a partir de `AAAA-MM`. */
export function formatMonthLabel(month: string): string {
  return format(localDate(`${month}-01`), "MMMM 'de' yyyy", { locale: ptBR })
}
