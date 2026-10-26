import { describe, expect, it } from 'vitest'
import { matchesQuizTitle, normalizeTitleForConfirmation } from './titleConfirmation'

describe('matchesQuizTitle', () => {
  it('accepts the exact title', () => {
    expect(matchesQuizTitle('Culture générale', 'Culture générale')).toBe(true)
  })

  it('ignores case and surrounding or repeated spaces', () => {
    expect(matchesQuizTitle('  culture   GÉNÉRALE ', 'Culture générale')).toBe(true)
  })

  it('accepts a plain hyphen for a typographic dash, so a title with « — » can be typed', () => {
    expect(matchesQuizTitle('Java - Niveau Expert', 'Java — Niveau Expert')).toBe(true)
    expect(matchesQuizTitle('Java – Niveau Expert', 'Java — Niveau Expert')).toBe(true)
  })

  it('accepts a straight apostrophe for a curly one', () => {
    expect(matchesQuizTitle("L'Art d'avoir toujours raison", 'L’Art d’avoir toujours raison')).toBe(true)
  })

  it('accepts decomposed accents (copy-paste from some sources)', () => {
    expect(matchesQuizTitle('Culture générale', 'Culture générale')).toBe(true)
  })

  it('rejects a different, a partial or an over-long title', () => {
    expect(matchesQuizTitle('Culture', 'Culture générale')).toBe(false)
    expect(matchesQuizTitle('Culture générale 2', 'Culture générale')).toBe(false)
    expect(matchesQuizTitle('Gestion de Projet IT', 'Culture générale')).toBe(false)
  })

  it('never matches an empty field', () => {
    expect(matchesQuizTitle('', 'Culture générale')).toBe(false)
    expect(matchesQuizTitle('   ', 'Culture générale')).toBe(false)
    expect(matchesQuizTitle('', '')).toBe(false)
  })
})

describe('normalizeTitleForConfirmation', () => {
  it('lowers case and simplifies spaces', () => {
    expect(normalizeTitleForConfirmation('  A   B ')).toBe('a b')
  })
})
