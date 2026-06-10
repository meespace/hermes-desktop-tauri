import type { CronJob } from '@/types/hermes'

export const STATE_DOT: Record<string, string> = {
  completed: 'bg-[var(--muted)]',
  disabled: 'bg-[var(--muted)]',
  enabled: 'bg-[var(--accent)]',
  error: 'bg-[var(--danger)]',
  paused: 'bg-amber-500',
  running: 'bg-[var(--accent)]',
  scheduled: 'bg-[var(--accent)]'
}

export function jobState(job: CronJob): string {
  const state = typeof job.state === 'string' ? job.state.trim() : ''

  return state || (job.enabled === false ? 'disabled' : 'scheduled')
}

export function jobTitle(job: CronJob): string {
  const pick = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  const clip = (value: string) => (value.length > 60 ? `${value.slice(0, 60)}...` : value)

  return pick(job.name) || clip(pick(job.prompt)) || clip(pick(job.script)) || job.id || 'Cron job'
}
