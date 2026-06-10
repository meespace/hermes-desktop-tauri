import type { MutableRefObject } from 'react'

export function setMutableRef<T>(ref: MutableRefObject<T>, value: T) {
  ref.current = value
}
