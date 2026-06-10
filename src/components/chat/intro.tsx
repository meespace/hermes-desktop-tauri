import { type CSSProperties, useState } from 'react'

import introCopyJsonl from './intro-copy.jsonl?raw'

type IntroCopy = {
  headline: string
  body: string
}

type IntroCopyRecord = IntroCopy & {
  personality: string
}

export type IntroProps = {
  personality?: string
  seed?: number
}

const NEUTRAL_PERSONALITIES = new Set(['', 'default', 'none', 'neutral'])

const FALLBACK_COPY: IntroCopy[] = [
  {
    headline: 'What are we moving today?',
    body: "Send a bug, branch, plan, or rough idea. I'll inspect the repo and turn it into the next concrete step."
  },
  {
    headline: "What's on your mind?",
    body: "Bring the code, question, or stuck part. I'll read the room before making changes."
  },
  {
    headline: 'What should Hermes look at?',
    body: "Send the task, failing path, or half-formed plan. I'll help turn it into action."
  },
  {
    headline: 'Where should we start?',
    body: "Bring the problem, goal, or file. I'll inspect first and keep the next step concrete."
  },
  {
    headline: 'What needs attention?',
    body: "Send the context you have. I'll help sort it into a plan or a fix."
  }
]

function normalizeKey(value?: string): string {
  return (value || '').trim().toLowerCase()
}

function titleize(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function isIntroCopyRecord(value: unknown): value is IntroCopyRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    typeof record.personality === 'string' &&
    typeof record.headline === 'string' &&
    typeof record.body === 'string' &&
    Boolean(record.personality.trim()) &&
    Boolean(record.headline.trim()) &&
    Boolean(record.body.trim())
  )
}

function parseIntroCopy(raw: string): Record<string, IntroCopy[]> {
  const byPersonality: Record<string, IntroCopy[]> = {}

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed) {
      continue
    }

    try {
      const parsed: unknown = JSON.parse(trimmed)

      if (!isIntroCopyRecord(parsed)) {
        continue
      }

      const key = normalizeKey(parsed.personality)
      byPersonality[key] ??= []
      byPersonality[key].push({
        headline: parsed.headline.trim(),
        body: parsed.body.trim()
      })
    } catch {
      // Bad generated copy should not break the whole desktop app.
    }
  }

  return byPersonality
}

const INTRO_COPY_BY_PERSONALITY = parseIntroCopy(introCopyJsonl)

function neutralCopy(): IntroCopy[] {
  return INTRO_COPY_BY_PERSONALITY.none || INTRO_COPY_BY_PERSONALITY.default || FALLBACK_COPY
}

function fallbackCopyForPersonality(personalityKey: string): IntroCopy[] {
  if (NEUTRAL_PERSONALITIES.has(personalityKey)) {
    return neutralCopy()
  }

  const label = titleize(personalityKey)

  return [
    {
      headline: `${label} mode is on. What should we work on?`,
      body: "Send the task, file, or rough idea. I'll use your configured voice and keep the work grounded in this repo."
    },
    {
      headline: `What does ${label} Hermes need to see?`,
      body: "Bring the context or the stuck part. I'll adapt to your configured personality."
    },
    {
      headline: `${label} mode is ready.`,
      body: "Send the problem, file, or idea. I'll follow the personality you've configured."
    },
    {
      headline: `What should ${label} Hermes tackle?`,
      body: "Drop the task here. I'll keep the work grounded in the repo."
    },
    {
      headline: 'Where should we begin?',
      body: `Give me the context and I'll answer in ${label} mode.`
    }
  ]
}

function pickCopy(copies: IntroCopy[], seed = 0): IntroCopy {
  return copies[Math.abs(seed) % copies.length] || FALLBACK_COPY[0]
}

function resolveCopy(personality?: string, seed?: number): IntroCopy {
  const personalityKey = normalizeKey(personality)

  const copies = NEUTRAL_PERSONALITIES.has(personalityKey)
    ? INTRO_COPY_BY_PERSONALITY[personalityKey] || neutralCopy()
    : INTRO_COPY_BY_PERSONALITY[personalityKey] || fallbackCopyForPersonality(personalityKey)

  return pickCopy(copies, seed)
}

export function Intro({ personality, seed }: IntroProps) {
  const [mountSeed] = useState(() => Math.floor(Math.random() * 100000))
  const copy = resolveCopy(personality, mountSeed + (seed ?? 0))

  return (
    <div
      className="pointer-events-none flex w-full min-w-0 flex-col items-center justify-center px-4 py-4 text-center text-[var(--muted)] sm:px-6"
      data-slot="aui_intro"
    >
      <div className="w-full min-w-0 max-w-[38rem] rounded-[1.35rem] border border-[color-mix(in_srgb,var(--foreground)_5%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface)_96%,transparent),color-mix(in_srgb,var(--background-secondary)_82%,transparent))] px-5 py-4 shadow-[0_1.25rem_3rem_-2.25rem_color-mix(in_srgb,var(--shadow-ink)_24%,transparent)] sm:px-6">
        <div className="mx-auto mb-2.5 flex w-fit items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--accent)_12%,transparent)] bg-[color-mix(in_srgb,var(--surface)_86%,transparent)] px-3 py-1 text-[0.58rem] font-medium tracking-[0.02em] text-[color-mix(in_srgb,var(--foreground)_66%,transparent)] shadow-[var(--field-shadow)]">
          <span
            aria-hidden="true"
            className="block size-4 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.92),rgba(96,165,250,0.62)_38%,rgba(59,130,246,0.12)_72%,transparent_100%)]"
          />
          Hermes Agent
        </div>
        <p
          className="mx-auto max-w-[30rem] text-balance text-[clamp(1.55rem,2.8vw,2.1rem)] font-semibold leading-[0.94] tracking-[-0.05em] text-[var(--foreground)]"
          style={{ '--fit-text-line-height': '0.92' } as CSSProperties}
        >
          {copy.headline}
        </p>
        <p className="mx-auto mt-2 max-w-[25rem] text-balance text-[0.76rem] leading-[1.35rem] tracking-[-0.015em] text-[color-mix(in_srgb,var(--foreground)_68%,transparent)]">
          {copy.body}
        </p>
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-[0.65rem] text-[color-mix(in_srgb,var(--foreground)_54%,transparent)]">
          <span className="rounded-full border border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] px-2.5 py-1 shadow-[var(--field-shadow)]">
            Local-first
          </span>
          <span className="rounded-full border border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] px-2.5 py-1 shadow-[var(--field-shadow)]">
            Files and terminal
          </span>
          <span className="rounded-full border border-[var(--workbench-divider)] bg-[color-mix(in_srgb,var(--surface)_82%,transparent)] px-2.5 py-1 shadow-[var(--field-shadow)]">
            Tools preserved
          </span>
        </div>
      </div>
    </div>
  )
}
