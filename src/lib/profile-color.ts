const PROFILE_TAG_SATURATION = 68
const PROFILE_TAG_LIGHTNESS = 58

function hashString(value: string): number {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

export function profileColor(name: null | string | undefined): null | string {
  const key = (name ?? '').trim()

  if (!key || key === 'default') {
    return null
  }

  const hue = hashString(key) % 360

  return `hsl(${hue} ${PROFILE_TAG_SATURATION}% ${PROFILE_TAG_LIGHTNESS}%)`
}

export function resolveProfileColor(
  name: null | string | undefined,
  overrides: Record<string, string>
): null | string {
  const key = (name ?? '').trim()

  if (!key || key === 'default') {
    return null
  }

  return overrides[key] ?? profileColor(key)
}

export const PROFILE_SWATCHES: readonly string[] = Array.from(
  { length: 12 },
  (_, index) => `hsl(${index * 30} ${PROFILE_TAG_SATURATION}% ${PROFILE_TAG_LIGHTNESS}%)`
)

export function profileColorSoft(color: string, percent = 16): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`
}
