// Ícones de traço simples; herdam a cor do texto (currentColor).
const PATHS = {
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  note: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  plus: 'M12 5v14M5 12h14',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M21 5H9l-6 7 6 7h12zM17 9l-6 6M11 9l6 6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  cloudOff: 'M3 3l18 18M8 8a5 5 0 0 0-1 0 4 4 0 0 0 0 8h10M20 16a3.5 3.5 0 0 0-3-6 6 6 0 0 0-6-4',
  sync: 'M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
