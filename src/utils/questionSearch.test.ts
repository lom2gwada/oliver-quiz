import { describe, expect, it } from 'vitest'
import type { Question } from '../types/quiz'
import { matchesQuestion, normalizeSearch } from './questionSearch'

const question = (text: string): Question => ({ id: 'q', category: 'c', difficulty: 'easy', question: text, tags: [], explanation: '', points: 1, type: 'boolean', content: { isTrue: true } })
const answerOf = () => 'Gustave Eiffel'

describe('normalizeSearch', () => {
  it('ignores case, accents and surrounding spaces', () => {
    expect(normalizeSearch('  Éléphant ')).toBe('elephant')
    expect(normalizeSearch('ÇA va')).toBe('ca va')
  })
})

describe('matchesQuestion', () => {
  it('keeps every question for an empty search', () => {
    expect(matchesQuestion(question('Qui a construit la tour ?'), '', answerOf)).toBe(true)
  })

  it('finds a word of the question text, whatever the accents', () => {
    expect(matchesQuestion(question('Quelle est la capitale de la Bolivie ?'), normalizeSearch('CAPITALE'), answerOf)).toBe(true)
    expect(matchesQuestion(question('Où se trouve l’île de Pâques ?'), normalizeSearch('ile de paques'), answerOf)).toBe(true)
  })

  it('finds a word of the correct answer', () => {
    expect(matchesQuestion(question('Qui a construit la tour ?'), normalizeSearch('eiffel'), answerOf)).toBe(true)
  })

  it('does not match an unrelated search', () => {
    expect(matchesQuestion(question('Qui a construit la tour ?'), normalizeSearch('guadeloupe'), answerOf)).toBe(false)
  })
})
