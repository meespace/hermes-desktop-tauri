import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { ArrowUpRight, FileText, MessageCircle, Sparkles } from '@/lib/icons'
import { $desktopVersion, $updateStatus, refreshDesktopVersion } from '@/store/updates'

import { ListRow, SectionHeading, SettingsContent } from './primitives'

const assetPath = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`

function ContactQrCard({
  title,
  description,
  imageSrc,
  imageAlt
}: {
  title: string
  description: string
  imageSrc: string
  imageAlt: string
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-[0.76rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] p-4">
      <div>
        <div className="text-[0.92rem] font-semibold tracking-[-0.024em] text-[var(--foreground)]">{title}</div>
        <p className="mt-1 text-[0.72rem] leading-5 text-[var(--muted)]">{description}</p>
      </div>
      <div className="flex flex-1 items-center justify-center rounded-[0.72rem] border border-[color-mix(in_srgb,var(--workbench-divider)_92%,transparent)] bg-white/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
        <img alt={imageAlt} className="aspect-square w-full max-w-[15rem] rounded-[0.72rem] object-contain" src={imageSrc} />
      </div>
    </div>
  )
}

export function AboutSettings() {
  const { t } = useI18n()
  const version = useStore($desktopVersion)
  const status = useStore($updateStatus)

  // The version atom is loaded once at app boot, which makes About show a
  // stale number after a self-update (the running binary is current, the
  // displayed string is not). Re-read on mount so opening About always
  // reflects the running build.
  useEffect(() => {
    void refreshDesktopVersion()
  }, [])

  return (
    <SettingsContent>
      <div className="flex flex-col items-start gap-3 rounded-[0.76rem] border border-[color-mix(in_srgb,var(--workbench-divider)_94%,transparent)] bg-[var(--workbench-panel-bg)] px-5 py-4 text-left">
        <span className="flex size-11 items-center justify-center rounded-[0.62rem] border border-[color-mix(in_srgb,var(--accent)_14%,transparent)] bg-[var(--workbench-active)] text-primary">
          <Sparkles className="size-6" />
        </span>
        <div>
          <div className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[var(--ui-text-quaternary)]">
            Desktop runtime
          </div>
          <h2 className="mt-2 text-[1.12rem] font-semibold tracking-[-0.035em]">Hermes Desktop Community</h2>
          <p className="mt-1 text-[0.72rem] text-[var(--muted)]">
            {version?.appVersion ? t.settings.about.version(version.appVersion) : t.settings.about.versionUnavailable}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <SectionHeading icon={FileText} title={t.settings.about.manualUpdates} />

        <ListRow
          description={t.settings.about.manualDescription}
          hint={t.settings.about.branchCommit(
            status?.branch ?? t.settings.about.unknown,
            status?.currentSha?.slice(0, 7) ?? t.settings.about.unknown
          )}
          title={t.settings.about.manualUpdates}
          action={
            <Button onClick={() => void window.hermesDesktop?.updates?.openRepository?.()} size="sm" variant="outline">
              <ArrowUpRight className="size-3.5" />
              {t.settings.about.openRepository}
            </Button>
          }
        />
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <SectionHeading icon={MessageCircle} title={t.settings.about.contactSection} />

        <div className="grid gap-3 sm:grid-cols-2">
          <ContactQrCard
            description={t.settings.about.wechatDescription}
            imageAlt={t.settings.about.wechatTitle}
            imageSrc={assetPath('author-wechat-qr.png')}
            title={t.settings.about.wechatTitle}
          />
          <ContactQrCard
            description={t.settings.about.officialAccountDescription}
            imageAlt={t.settings.about.officialAccountTitle}
            imageSrc={assetPath('official-account-qr.png')}
            title={t.settings.about.officialAccountTitle}
          />
        </div>
      </div>
    </SettingsContent>
  )
}
