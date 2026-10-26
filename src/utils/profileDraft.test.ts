import { describe, expect, it } from 'vitest'
import { isPseudoDirty } from './profileDraft'

describe('isPseudoDirty', () => {
  it('is false while the draft is the saved pseudo, whatever the surrounding spaces', () => {
    expect(isPseudoDirty({ pseudo: 'Olivier' }, 'Olivier')).toBe(false)
    expect(isPseudoDirty({ pseudo: 'Olivier' }, '  Olivier ')).toBe(false)
  })

  it('is true as soon as the pseudo differs', () => {
    expect(isPseudoDirty({ pseudo: 'Olivier' }, 'Olivier2')).toBe(true)
    expect(isPseudoDirty({ pseudo: 'Olivier' }, '')).toBe(true)
  })

  it('treats any typed pseudo as unsaved while no profile is loaded', () => {
    expect(isPseudoDirty(null, 'Nouveau')).toBe(true)
    expect(isPseudoDirty(null, '')).toBe(false)
  })
})
