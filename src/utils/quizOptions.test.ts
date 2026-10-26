import { describe, expect, it } from 'vitest'
import { buildQuizOptions } from './quizOptions'

const hosted = [{ id: 'b', title: 'Beta' }, { id: 'a', title: 'Alpha' }, { id: 'c', title: 'Écureuil' }]

describe('buildQuizOptions', () => {
  it('lists every accessible quiz, sorted by name, even those without any game', () => {
    const options = buildQuizOptions({ hosted, seen: [], active: { key: 'a', label: 'Alpha' }, language: 'fr' })
    expect(options.map((option) => option.label)).toEqual(['Alpha', 'Beta', 'Écureuil'])
  })

  it('gives the same list and order whichever page the games were seen on', () => {
    const history = buildQuizOptions({ hosted, seen: [{ key: 'b', label: 'Beta' }], active: { key: 'a', label: 'Alpha' }, language: 'fr' })
    const leaderboard = buildQuizOptions({ hosted, seen: [{ key: 'c', label: 'Écureuil' }, { key: 'a', label: 'Alpha' }], active: { key: 'a', label: 'Alpha' }, language: 'fr' })
    expect(leaderboard).toEqual(history)
  })

  it('keeps a deleted quiz that still has data, under its frozen title', () => {
    const options = buildQuizOptions({ hosted, seen: [{ key: 'Ancien quiz', label: 'Ancien quiz' }], active: { key: 'a', label: 'Alpha' }, language: 'fr' })
    expect(options.map((option) => option.key)).toEqual(['a', 'Ancien quiz', 'b', 'c'])
  })

  it('prefers the current title of a renamed quiz over the frozen one, and the active quiz title over all', () => {
    const renamed = buildQuizOptions({ hosted, seen: [{ key: 'b', label: 'Vieux titre' }], active: { key: 'a', label: 'Alpha' }, language: 'fr' })
    expect(renamed.find((option) => option.key === 'b')?.label).toBe('Beta')
    const active = buildQuizOptions({ hosted, seen: [], active: { key: 'b', label: 'Beta (titre à jour)' }, language: 'fr' })
    expect(active.find((option) => option.key === 'b')?.label).toBe('Beta (titre à jour)')
  })

  it('always includes the active quiz, even when it is not in the accessible list', () => {
    const options = buildQuizOptions({ hosted: [], seen: [], active: { key: 'Culture générale', label: 'Culture générale' }, language: 'fr' })
    expect(options).toEqual([{ key: 'Culture générale', label: 'Culture générale' }])
  })

  it('sorts accents and case naturally for the language', () => {
    const options = buildQuizOptions({ hosted: [{ id: '1', title: 'zèbre' }, { id: '2', title: 'Étude' }, { id: '3', title: 'abc' }], seen: [], active: { key: '3', label: 'abc' }, language: 'fr' })
    expect(options.map((option) => option.label)).toEqual(['abc', 'Étude', 'zèbre'])
  })
})
