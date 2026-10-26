import { describe, expect, it } from 'vitest'
import { fr } from '../i18n/fr'
import { timedDurationLabel } from './timedDuration'

const t = (key: string, ...args: unknown[]) => {
  const entry = (fr as unknown as Record<string, string | ((...a: unknown[]) => string)>)[key]
  return typeof entry === 'function' ? entry(...args) : entry
}

describe('timedDurationLabel', () => {
  it('says the duration once when the game ran to the end', () => {
    expect(timedDurationLabel(300, 300, t)).toBe('⏱ 5:00')
  })

  it('gives both the elapsed time and the chosen duration when the game stopped early', () => {
    expect(timedDurationLabel(192, 300, t)).toBe('⏱ 3:12 sur 5 min')
  })

  it('says no limit for a practice game, with the time actually spent', () => {
    expect(timedDurationLabel(192, 0, t)).toBe('⏱ 3:12 · sans limite')
  })

  it('never repeats the duration in the full-length case', () => {
    expect(timedDurationLabel(600, 600, t)).not.toContain('min')
  })
})
