import { Leva, useControls } from 'leva'
import { type CSSProperties, useEffect, useMemo, useState } from 'react'

export function Backdrop() {
  const [controlsOpen, setControlsOpen] = useState(false)

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null

      const editing =
        target?.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement

      if (editing || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      if (event.shiftKey && event.code === 'KeyY') {
        setControlsOpen(open => !open)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const shape = useControls(
    'UI / Shape',
    { radiusScalar: { value: 0.2, min: 0, max: 2, step: 0.1, label: 'radius scalar' } },
    { collapsed: true }
  )

  useEffect(() => {
    document.documentElement.style.setProperty('--radius-scalar', String(shape.radiusScalar))
  }, [shape.radiusScalar])

  const atmosphere = useControls(
    'Backdrop / Atmosphere',
    {
      enabled: { value: true, label: 'on' },
      washOpacity: { value: 0.78, min: 0.45, max: 1, step: 0.01, label: 'wash' },
      glowOpacity: { value: 0.12, min: 0, max: 0.4, step: 0.01, label: 'glow' },
      blur: { value: 56, min: 0, max: 140, step: 2, label: 'blur' },
      scale: { value: 34, min: 18, max: 60, step: 1, label: 'orb size' }
    },
    { collapsed: true }
  )

  const orbSize = `${atmosphere.scale}rem`
  const blur = `${atmosphere.blur}px`
  const highlightStyle = useMemo<CSSProperties>(
    () => ({
      background: `radial-gradient(circle at center, color-mix(in srgb, var(--accent) ${Math.round(atmosphere.glowOpacity * 100)}%, transparent) 0%, transparent 68%)`,
      filter: `blur(${blur})`
    }),
    [atmosphere.glowOpacity, blur]
  )

  const warmHighlightStyle = useMemo<CSSProperties>(
    () => ({
      background:
        'radial-gradient(circle at center, color-mix(in srgb, var(--theme-warm) 18%, transparent) 0%, transparent 72%)',
      filter: `blur(${blur})`
    }),
    [blur]
  )

  return (
    <>
      <Leva collapsed hidden={!import.meta.env.DEV || !controlsOpen} titleBar={{ title: 'backdrop', drag: true }} />

      {atmosphere.enabled && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden" style={{ opacity: atmosphere.washOpacity }}>
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--background) 92%, white 8%) 0%, color-mix(in srgb, var(--background) 96%, var(--accent-soft) 4%) 100%)'
            }}
          />
          <div className="absolute left-1/2 top-[10%] -translate-x-1/2 rounded-full" style={{ ...highlightStyle, height: orbSize, width: orbSize }} />
          <div className="absolute -left-20 bottom-[-5rem] h-[24rem] w-[24rem] rounded-full" style={warmHighlightStyle} />
          <div
            className="absolute right-[-4rem] top-[18%] h-[18rem] w-[18rem] rounded-full"
            style={{
              background:
                'radial-gradient(circle at center, color-mix(in srgb, var(--foreground) 5%, transparent) 0%, transparent 70%)',
              filter: `blur(${blur})`
            }}
          />
        </div>
      )}
    </>
  )
}
