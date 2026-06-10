// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Codicon } from './codicon'

describe('Codicon', () => {
  it('uses compact alignment classes suitable for toolbar controls', () => {
    const { container } = render(<Codicon name="search" />)
    const icon = container.querySelector('i')

    expect(icon?.className).toContain('inline-block')
    expect(icon?.className).toContain('shrink-0')
    expect(icon?.className).toContain('align-middle')
    expect(icon?.className).toContain('leading-none')
  })
})
