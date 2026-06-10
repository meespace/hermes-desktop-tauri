interface ComposerLayoutInput {
  expanded: boolean
  narrow: boolean
  tight: boolean
}

interface ComposerLayout {
  controlsStacked: boolean
  metaStacked: boolean
}

export function composerLayoutForState({ expanded, narrow, tight }: ComposerLayoutInput): ComposerLayout {
  const widthConstrained = narrow || tight

  return {
    controlsStacked: expanded || widthConstrained,
    metaStacked: widthConstrained
  }
}
