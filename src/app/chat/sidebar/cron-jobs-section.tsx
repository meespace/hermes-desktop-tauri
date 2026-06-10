import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { DisclosureCaret } from '@/components/ui/disclosure-caret'
import { SidebarGroup, SidebarGroupContent } from '@/components/ui/sidebar'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { notifyError } from '@/store/notifications'
import type { CronJob } from '@/types/hermes'

import { jobState, jobTitle, STATE_DOT } from '../../cron/job-state'
import { SidebarPanelLabel } from '../../shell/sidebar-label'

interface SidebarCronJobsSectionProps {
  jobs: CronJob[]
  label?: string
  max?: number
  onManageJob: (jobId: string) => void
  onToggle: () => void
  onTriggerJob: (jobId: string) => Promise<void> | void
  open: boolean
}

export function SidebarCronJobsSection({
  jobs,
  label,
  max = 8,
  onManageJob,
  onToggle,
  onTriggerJob,
  open
}: SidebarCronJobsSectionProps) {
  const { t } = useI18n()
  const shown = useMemo(() => jobs.slice(0, max), [jobs, max])
  const countLabel = jobs.length > max ? `${max}+` : String(jobs.length)
  const sectionLabel = label ?? t.sidebar.cronJobs

  return (
    <SidebarGroup className="shrink-0 p-0 pb-1">
      <div className="group/section flex shrink-0 items-center justify-between pb-1 pt-1.5">
        <button
          className="group/section-label flex w-fit cursor-pointer items-center gap-1 bg-transparent text-left leading-none"
          onClick={onToggle}
          type="button"
        >
          <SidebarPanelLabel>{sectionLabel}</SidebarPanelLabel>
          <span className="text-[0.6875rem] font-medium text-[var(--muted)]">{countLabel}</span>
          <DisclosureCaret className="text-[var(--muted)] opacity-0 transition group-hover/section-label:opacity-100" open={open} />
        </button>
      </div>
      {open && (
        <SidebarGroupContent className="flex max-h-56 shrink-0 flex-col gap-px overflow-y-auto overscroll-contain pb-1">
          {shown.map(job => (
            <SidebarCronJobRow
              job={job}
              key={job.id}
              onManage={() => onManageJob(job.id)}
              onTrigger={() => onTriggerJob(job.id)}
            />
          ))}
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  )
}

function SidebarCronJobRow({
  job,
  onManage,
  onTrigger
}: {
  job: CronJob
  onManage: () => void
  onTrigger: () => Promise<void> | void
}) {
  const { t } = useI18n()
  const [triggering, setTriggering] = useState(false)
  const state = jobState(job)
  const title = jobTitle(job)

  const runNow = async () => {
    if (triggering) {
      return
    }

    setTriggering(true)

    try {
      await onTrigger()
    } catch (error) {
      notifyError(error, t.cron.triggerFailed)
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="group/cron grid min-h-[1.625rem] grid-cols-[minmax(0,1fr)_auto] items-center rounded-md hover:bg-[var(--workbench-hover)]">
      <button
        className="flex min-w-0 cursor-pointer items-center gap-1.5 bg-transparent py-0.5 pl-2 pr-1 text-left"
        onClick={onManage}
        title={title}
        type="button"
      >
        <span className="grid w-3.5 shrink-0 place-items-center">
          <span
            aria-hidden="true"
            className={cn(
              'size-1 rounded-full',
              STATE_DOT[state] ?? 'bg-[var(--muted)]',
              state === 'running' && 'size-1.5 animate-pulse'
            )}
          />
        </span>
        <span className="min-w-0 truncate text-[0.8125rem] text-[color-mix(in_srgb,var(--foreground)_74%,transparent)] group-hover/cron:text-foreground">
          {title}
        </span>
      </button>
      <Button
        aria-label={`Run ${title} now`}
        className="mr-1 size-5 opacity-0 group-hover/cron:opacity-100"
        disabled={triggering}
        onClick={event => {
          event.stopPropagation()
          void runNow()
        }}
        size="icon-xs"
        title={t.cron.triggerNow}
        type="button"
        variant="ghost"
      >
        <Codicon name={triggering ? 'loading' : 'zap'} size="0.75rem" spinning={triggering} />
      </Button>
    </div>
  )
}
