import { describe, expect, it } from 'vitest'

import {
  TITLEBAR_CONTROL_OFFSET_X,
  TITLEBAR_CONTROLS_TOP,
  TITLEBAR_EDGE_INSET,
  TITLEBAR_FALLBACK_WINDOW_BUTTON_X,
  titlebarControlsPosition
} from './titlebar'

describe('titlebarControlsPosition', () => {
  it('offsets controls from visible traffic lights', () => {
    expect(titlebarControlsPosition({ x: 24, y: 10 }).left).toBe(24 + TITLEBAR_CONTROL_OFFSET_X)
  })

  it('keeps custom controls vertically centered instead of following traffic-light tuning', () => {
    expect(titlebarControlsPosition({ x: 24, y: 18 }).top).toBe(TITLEBAR_CONTROLS_TOP)
    expect(titlebarControlsPosition({ x: 24, y: 21 }).top).toBe(TITLEBAR_CONTROLS_TOP)
  })

  it('pins to the edge when macOS fullscreen hides traffic lights', () => {
    expect(titlebarControlsPosition({ x: 24, y: 10 }, true).left).toBe(TITLEBAR_EDGE_INSET)
    expect(titlebarControlsPosition({ x: 24, y: 18 }, true).top).toBe(TITLEBAR_CONTROLS_TOP)
  })

  it('pins to the edge on Windows/Linux where native controls render on the right', () => {
    expect(titlebarControlsPosition(null).left).toBe(TITLEBAR_EDGE_INSET)
    expect(titlebarControlsPosition(null).top).toBe(TITLEBAR_CONTROLS_TOP)
  })

  it('uses the macOS fallback while the initial window state is unknown', () => {
    expect(titlebarControlsPosition(undefined).left).toBe(TITLEBAR_FALLBACK_WINDOW_BUTTON_X + TITLEBAR_CONTROL_OFFSET_X)
  })
})
