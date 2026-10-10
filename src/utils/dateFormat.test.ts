import { describe, expect, it } from 'vitest'
import { longDate, shortDate } from './dateFormat'

// Midi UTC : la même date calendaire dans tous les fuseaux raisonnables.
const noon = '2026-10-06T12:00:00Z'

describe('dateFormat', () => {
  it('formats a long French date with the year', () => {
    expect(longDate(noon, 'fr')).toBe('6 oct. 2026')
  })

  it('formats a long English date with the year', () => {
    expect(longDate(noon, 'en')).toMatch(/6 Oct(ober)? 2026/)
  })

  it('omits the year in the short format', () => {
    expect(shortDate(noon, 'fr')).toBe('6 oct.')
  })
})
