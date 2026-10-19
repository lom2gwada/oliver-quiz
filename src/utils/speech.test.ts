import { describe, expect, it } from 'vitest'
import type { Question } from '../types/quiz'
import { questionToSpeech } from './speech'

const question = (text: string): Question => ({
  id: 'q', type: 'text', theme: 't', difficulty: 'easy', points: 1, question: text,
  content: { correctAnswer: 'x', acceptedAnswers: [] },
}) as unknown as Question

describe('questionToSpeech', () => {
  it('ne lit que l’énoncé, nettoyé des espaces superflus', () => {
    expect(questionToSpeech(question('  Quelle est   la capitale de la France ?  '), 'fr-FR')).toBe('Quelle est la capitale de la France ?')
  })

  it('remplace les trous par « blanc » en français et « blank » en anglais', () => {
    expect(questionToSpeech(question('Paris est la capitale de ___.'), 'fr-FR')).toBe('Paris est la capitale de blanc .')
    expect(questionToSpeech(question('The capital of France is ______.'), 'en-GB')).toBe('The capital of France is blank .')
  })

  it('marque seulement une pause pour une autre langue', () => {
    expect(questionToSpeech(question('Die Hauptstadt ist ___'), 'de')).toBe('Die Hauptstadt ist ,')
  })

  it('retire les apostrophes inversées du code en ligne', () => {
    expect(questionToSpeech(question('Que renvoie `Array.isArray([])` ?'), 'fr-FR')).toBe('Que renvoie Array.isArray([]) ?')
  })
})
