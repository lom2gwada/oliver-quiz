import { describe, expect, it } from 'vitest'
import { MIN_QUESTION_DISPLAY_MS, advanceAllowed } from './useAdvanceGuard'

describe('advanceAllowed', () => {
  it('ignores a second click arriving right after the question was shown', () => {
    expect(advanceAllowed(1000, 1000)).toBe(false)
    expect(advanceAllowed(1000, 1000 + 250)).toBe(false)
    expect(advanceAllowed(1000, 1000 + MIN_QUESTION_DISPLAY_MS - 1)).toBe(false)
  })

  it('accepts a click once the question has been on screen long enough', () => {
    expect(advanceAllowed(1000, 1000 + MIN_QUESTION_DISPLAY_MS)).toBe(true)
    expect(advanceAllowed(1000, 1000 + 5000)).toBe(true)
  })

  it('covers a slow double click (about half a second apart)', () => {
    expect(MIN_QUESTION_DISPLAY_MS).toBeGreaterThanOrEqual(600)
    expect(advanceAllowed(0, 500)).toBe(false)
  })
})
