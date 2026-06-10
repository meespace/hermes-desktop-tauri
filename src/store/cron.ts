import { atom } from 'nanostores'

import type { CronJob } from '@/types/hermes'

export const $cronJobs = atom<CronJob[]>([])
export const setCronJobs = (jobs: CronJob[]) => $cronJobs.set(jobs)
export const updateCronJobs = (fn: (jobs: CronJob[]) => CronJob[]) => $cronJobs.set(fn($cronJobs.get()))

export const $cronFocusJobId = atom<null | string>(null)
export const setCronFocusJobId = (id: null | string) => $cronFocusJobId.set(id)
