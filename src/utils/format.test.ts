import { describe, expect, it } from 'vitest'
import { formatNumber, formatPercent } from './format'

describe('formatNumber', () => {
  it('uses the decimal comma in French and the point in English', () => {
    expect(formatNumber(8.2, 'fr')).toBe('8,2')
    expect(formatNumber(8.2, 'en')).toBe('8.2')
  })

  it('drops a useless trailing zero and rounds to one decimal by default', () => {
    expect(formatNumber(8, 'fr')).toBe('8')
    expect(formatNumber(8.04, 'en')).toBe('8')
    expect(formatNumber(8.26, 'fr')).toBe('8,3')
  })

  it('accepts another precision', () => {
    expect(formatNumber(1.2345, 'en', 2)).toBe('1.23')
  })
})

describe('formatPercent', () => {
  it('writes « 93,7 % » in French (a space before the sign) and « 93.7% » in English', () => {
    expect(formatPercent(93.7, 'fr', 1)).toMatch(/^93,7\s%$/)
    expect(formatPercent(93.7, 'en', 1)).toBe('93.7%')
  })

  it('shows whole percentages by default', () => {
    expect(formatPercent(94, 'fr')).toMatch(/^94\s%$/)
    expect(formatPercent(94, 'en')).toBe('94%')
    expect(formatPercent(93.7, 'en')).toBe('94%')
  })

  it('handles the bounds', () => {
    expect(formatPercent(0, 'en')).toBe('0%')
    expect(formatPercent(100, 'fr')).toMatch(/^100\s%$/)
  })
})
