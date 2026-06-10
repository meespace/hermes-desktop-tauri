import type { HermesConnection } from '@/global'

export const TITLEBAR_HEIGHT = 38
export const MACOS_TRAFFIC_LIGHTS_HEIGHT = 14
export const TITLEBAR_ICON_SIZE = 12
export const TITLEBAR_CONTROL_OFFSET_X = 68
export const TITLEBAR_CONTROL_HEIGHT = 24
export const TITLEBAR_CONTROLS_TOP = Math.round((TITLEBAR_HEIGHT - TITLEBAR_CONTROL_HEIGHT) / 2)
export const TITLEBAR_FALLBACK_WINDOW_BUTTON_X = 14
export const TITLEBAR_MACOS_CENTER_OFFSET = Math.round((TITLEBAR_CONTROL_HEIGHT - MACOS_TRAFFIC_LIGHTS_HEIGHT) / 2)
// Edge inset used when no left-side native controls take up that space —
// Windows/Linux (native overlay is on the right) and macOS fullscreen
// (traffic lights are hidden). Matches the right-cluster's 0.75rem padding.
export const TITLEBAR_EDGE_INSET = 14

export const titlebarButtonClass =
  'h-[var(--titlebar-control-height)] w-[var(--titlebar-control-size)] shrink-0 cursor-pointer rounded-[0.46rem] border border-transparent bg-transparent text-[color-mix(in_srgb,var(--foreground)_56%,transparent)] shadow-none transition-[background-color,border-color,color] duration-[var(--motion-duration-soft)] ease-[var(--motion-ease-soft)] hover:border-[color-mix(in_srgb,var(--foreground)_4%,transparent)] hover:bg-[var(--workbench-hover)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--focus)_18%,transparent)] active:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]'

export const titlebarHeaderBaseClass =
  'pointer-events-none relative z-3 flex h-[var(--titlebar-height)] shrink-0 items-center justify-start gap-2 bg-transparent px-[max(0.75rem,var(--titlebar-content-inset,0rem))]'

export const titlebarHeaderShadowClass =
  "after:pointer-events-none after:absolute after:left-0 after:right-0 after:top-full after:h-3 after:bg-linear-to-b after:from-[color-mix(in_srgb,var(--surface)_42%,transparent)] after:to-transparent after:content-['']"

export function titlebarControlsPosition(
  windowButtonPosition: HermesConnection['windowButtonPosition'] | undefined,
  isFullscreen = false
) {
  const top = TITLEBAR_CONTROLS_TOP

  // No left-side native controls to dodge:
  //   - Windows/Linux: native min/max/close render on the right via titleBarOverlay.
  //   - macOS fullscreen: traffic lights are hidden.
  // In both cases, pin the cluster to the edge with a small inset.
  if (windowButtonPosition === null || isFullscreen) {
    return { left: TITLEBAR_EDGE_INSET, top }
  }

  return {
    left: (windowButtonPosition?.x ?? TITLEBAR_FALLBACK_WINDOW_BUTTON_X) + TITLEBAR_CONTROL_OFFSET_X,
    top
  }
}
