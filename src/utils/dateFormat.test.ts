import { describe, expect, it } from 'vitest'
import { localDay, longDate, shortDate } from './dateFormat'

// Midi UTC : la même date calendaire dans tous les fuseaux raisonnables.
const noon = '2026-10-06T12:00:00Z'

describe('dateFormat', () => {
  it('formats a long French date with the year', () => {
    expect(longDate(noon, 'fr')).toBe('6 oct. 2026')
  })

  it('formats a long English date with the year', () => {
    expect(longDate(noon, 'en')).toMatch(/6 Oct(ober)? 2026/)
  })

  it('gives the local day as AAAA-MM-JJ, with zero padding', () => {
    expect(localDay(new Date(2026, 10, 24, 15, 0))).toBe('2026-11-24')
    expect(localDay(new Date(2026, 0, 5, 9, 0))).toBe('2026-01-05')
  })

  it('keeps the local day just after midnight and just before the next one (not the UTC day)', () => {
    expect(localDay(new Date(2026, 10, 24, 0, 0, 1))).toBe('2026-11-24')
    expect(localDay(new Date(2026, 10, 24, 23, 59, 59))).toBe('2026-11-24')
  })

  it('handles the end of the year and a leap day', () => {
    expect(localDay(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31')
    expect(localDay(new Date(2028, 1, 29, 12, 0))).toBe('2028-02-29')
  })

  it('omits the year in the short format', () => {
    expect(shortDate(noon, 'fr')).toBe('6 oct.')
  })
})
