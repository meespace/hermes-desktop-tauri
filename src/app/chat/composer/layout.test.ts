import { describe, expect, it } from 'vitest'

import { composerLayoutForState } from './layout'

describe('composer layout state', () => {
  it('keeps metadata attached when the input expands on a wide composer', () => {
    expect(composerLayoutForState({ expanded: true, narrow: false, tight: false })).toEqual({
      controlsStacked: true,
      metaStacked: false
    })
  })

  it('stacks metadata only when the composer is width-constrained', () => {
    expect(composerLayoutForState({ expanded: false, narrow: true, tight: false })).toMatchObject({
      metaStacked: true
    })
    expect(composerLayoutForState({ expanded: false, narrow: false, tight: true })).toMatchObject({
      metaStacked: true
    })
  })
})
