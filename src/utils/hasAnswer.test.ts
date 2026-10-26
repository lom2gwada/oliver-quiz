import { describe, expect, it } from 'vitest'
import { hasAnswer } from './hasAnswer'

describe('hasAnswer', () => {
  it('is false without an answer, with blank text or with an empty selection', () => {
    expect(hasAnswer(undefined)).toBe(false)
    expect(hasAnswer('')).toBe(false)
    expect(hasAnswer('   ')).toBe(false)
    expect(hasAnswer([])).toBe(false)
  })

  it('is true for some text or at least one selected id', () => {
    expect(hasAnswer('Paris')).toBe(true)
    expect(hasAnswer('0')).toBe(true)
    expect(hasAnswer(['a'])).toBe(true)
    expect(hasAnswer(['a', 'b'])).toBe(true)
  })
})
