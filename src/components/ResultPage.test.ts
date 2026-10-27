import { describe, expect, it } from 'vitest'
import type {
  BooleanQuestion, ClozeQuestion, CodeQuestion, MatchingQuestion, NumericQuestion, OrderingQuestion, QCMQuestion, TextQuestion,
} from '../types/quiz'
import { correctAnswer, isCorrect, userAnswer } from './ResultPage'

const shared = { id: 'q1', category: 'general', difficulty: 'easy' as const, tags: [], explanation: 'Explication.' }

describe('qcm', () => {
  const single: QCMQuestion = {
    ...shared, type: 'qcm', question: 'Q ?', points: 1,
    content: { multiple: false, answers: [{ id: 'a', label: 'A', isCorrect: true }, { id: 'b', label: 'B', isCorrect: false }] },
  }
  const multiple: QCMQuestion = {
    ...shared, type: 'qcm', question: 'Q ?', points: 1,
    content: { multiple: true, answers: [{ id: 'a', label: 'A', isCorrect: true }, { id: 'b', label: 'B', isCorrect: true }, { id: 'c', label: 'C', isCorrect: false }] },
  }

  it('is correct when the single right answer is selected', () => expect(isCorrect(single, ['a'])).toBe(true))
  it('is incorrect when the wrong answer is selected', () => expect(isCorrect(single, ['b'])).toBe(false))
  it('is incorrect when unanswered', () => expect(isCorrect(single, undefined)).toBe(false))
  it('is correct when all right answers are selected regardless of order', () => expect(isCorrect(multiple, ['b', 'a'])).toBe(true))
  it('is incorrect when only some right answers are selected', () => expect(isCorrect(multiple, ['a'])).toBe(false))
  it('is incorrect when a wrong answer is included', () => expect(isCorrect(multiple, ['a', 'b', 'c'])).toBe(false))
  it('reports the correct answer label', () => expect(correctAnswer(single)).toBe('A'))
  it('reports the given answer label', () => expect(userAnswer(single, ['b'])).toBe('B'))
  it('reports no answer when unanswered', () => expect(userAnswer(single, undefined)).toBe('Aucune réponse'))
})

describe('code', () => {
  const question: CodeQuestion = {
    ...shared, type: 'code', question: 'Q ?', points: 2,
    content: { language: 'js', snippet: 'const x = 1', multiple: false, answers: [{ id: 'a', label: 'A', isCorrect: true }, { id: 'b', label: 'B', isCorrect: false }] },
  }

  it('is correct when the right answer is selected', () => expect(isCorrect(question, ['a'])).toBe(true))
  it('is incorrect when the wrong answer is selected', () => expect(isCorrect(question, ['b'])).toBe(false))
  it('reports the correct and given answer labels', () => {
    expect(correctAnswer(question)).toBe('A')
    expect(userAnswer(question, ['b'])).toBe('B')
  })
})

describe('text', () => {
  const insensitive: TextQuestion = { ...shared, type: 'text', question: 'Q ?', points: 2, content: { expectedAnswers: ['Paris'], caseSensitive: false } }
  const sensitive: TextQuestion = { ...shared, type: 'text', question: 'Q ?', points: 2, content: { expectedAnswers: ['Paris'], caseSensitive: true } }

  it('matches case-insensitively and trims whitespace', () => {
    expect(isCorrect(insensitive, 'PARIS')).toBe(true)
    expect(isCorrect(insensitive, ' paris ')).toBe(true)
  })
  it('rejects a wrong answer', () => expect(isCorrect(insensitive, 'Lyon')).toBe(false))
  it('rejects unanswered questions', () => expect(isCorrect(insensitive, undefined)).toBe(false))
  it('respects caseSensitive', () => expect(isCorrect(sensitive, 'paris')).toBe(false))
  it('reports the correct answer', () => expect(correctAnswer(insensitive)).toBe('Paris'))
  it('reports the given answer', () => expect(userAnswer(insensitive, 'Lyon')).toBe('Lyon'))
  it('reports no answer for empty or whitespace-only input', () => {
    expect(userAnswer(insensitive, '')).toBe('Aucune réponse')
    expect(userAnswer(insensitive, '   ')).toBe('Aucune réponse')
    expect(userAnswer(insensitive, undefined)).toBe('Aucune réponse')
  })
})

describe('text — tolerant matching (engine matchesExpected)', () => {
  const napoleon: TextQuestion = { ...shared, type: 'text', question: 'Quel empereur ?', points: 1, content: { expectedAnswers: ['Napoléon'], caseSensitive: false } }
  const country: TextQuestion = { ...shared, type: 'text', question: 'Quel pays ?', points: 1, content: { expectedAnswers: ['Le Pérou'], caseSensitive: false } }
  const capital: TextQuestion = { ...shared, type: 'text', question: 'Quelle capitale ?', points: 1, content: { expectedAnswers: ['Bridgetown'], caseSensitive: false } }

  it('accepts a missing accent', () => {
    expect(isCorrect(napoleon, 'napoleon')).toBe(true)
    expect(isCorrect(napoleon, 'NAPOLEON')).toBe(true)
  })

  it('accepts an answer typed with accents when the expected one has none', () => {
    expect(isCorrect({ ...napoleon, content: { expectedAnswers: ['Napoleon'], caseSensitive: false } }, 'Napoléon')).toBe(true)
  })

  it('ignores the leading article', () => {
    expect(isCorrect(country, 'Pérou')).toBe(true)
    expect(isCorrect(country, 'perou')).toBe(true)
    expect(isCorrect(country, 'le perou')).toBe(true)
  })

  it('accepts one typo on a long word, but not two', () => {
    expect(isCorrect(capital, 'Bridgetwon')).toBe(true)
    expect(isCorrect(capital, 'Bridgtwon')).toBe(false)
  })

  it('does not forgive a typo on a short word or a number', () => {
    expect(isCorrect({ ...napoleon, content: { expectedAnswers: ['Cuba'], caseSensitive: false } }, 'Cube')).toBe(false)
    expect(isCorrect({ ...napoleon, content: { expectedAnswers: ['1789'], caseSensitive: false } }, '1788')).toBe(false)
  })

  it('stays strict when the question is case-sensitive: no accent, case or typo tolerance', () => {
    const strict: TextQuestion = { ...napoleon, content: { expectedAnswers: ['Napoléon'], caseSensitive: true } }
    expect(isCorrect(strict, 'Napoléon')).toBe(true)
    expect(isCorrect(strict, 'napoléon')).toBe(false)
    expect(isCorrect(strict, 'Napoleon')).toBe(false)
  })

  it('applies to fill-in-the-blank questions too', () => {
    const cloze: ClozeQuestion = { ...shared, type: 'cloze', question: 'L’empereur exilé à Sainte-Hélène est ___.', points: 1, content: { expectedAnswers: ['Napoléon'], caseSensitive: false } }
    expect(isCorrect(cloze, 'napoleon')).toBe(true)
    expect(isCorrect(cloze, 'Louis')).toBe(false)
  })
})

describe('cloze', () => {
  const question: ClozeQuestion = { ...shared, type: 'cloze', question: 'La capitale est ___.', points: 1, content: { expectedAnswers: ['Paris'], caseSensitive: false } }

  it('scores like a text question', () => {
    expect(isCorrect(question, 'paris')).toBe(true)
    expect(isCorrect(question, 'Lyon')).toBe(false)
  })
  it('reports the correct and given answers', () => {
    expect(correctAnswer(question)).toBe('Paris')
    expect(userAnswer(question, 'Lyon')).toBe('Lyon')
  })
})

describe('ordering', () => {
  const question: OrderingQuestion = {
    ...shared, type: 'ordering', question: 'Q ?', points: 3,
    content: { items: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }], correctOrder: ['a', 'b', 'c'] },
  }

  it('is correct only when the exact order matches', () => {
    expect(isCorrect(question, ['a', 'b', 'c'])).toBe(true)
    expect(isCorrect(question, ['b', 'a', 'c'])).toBe(false)
  })
  it('is incorrect when the order is incomplete', () => expect(isCorrect(question, ['a', 'b'])).toBe(false))
  it('is incorrect when unanswered', () => expect(isCorrect(question, undefined)).toBe(false))
  it('reports the correct order as labels', () => expect(correctAnswer(question)).toBe('A → B → C'))
  it('reports the given order as labels', () => expect(userAnswer(question, ['c', 'a', 'b'])).toBe('C → A → B'))
  it('reports no answer when untouched', () => {
    expect(userAnswer(question, undefined)).toBe('Aucune réponse')
    expect(userAnswer(question, [])).toBe('Aucune réponse')
  })
})

describe('boolean', () => {
  const question: BooleanQuestion = { ...shared, type: 'boolean', question: 'Vrai ou faux ?', points: 1, content: { isTrue: true } }

  it('is correct when the matching value is given', () => expect(isCorrect(question, ['true'])).toBe(true))
  it('is incorrect when the opposite value is given', () => expect(isCorrect(question, ['false'])).toBe(false))
  it('is incorrect when unanswered', () => expect(isCorrect(question, undefined)).toBe(false))
  it('reports the correct answer as Vrai/Faux', () => expect(correctAnswer(question)).toBe('Vrai'))
  it('reports the given answer as Vrai/Faux', () => expect(userAnswer(question, ['false'])).toBe('Faux'))
  it('reports no answer when unanswered', () => expect(userAnswer(question, undefined)).toBe('Aucune réponse'))
})

describe('matching', () => {
  const question: MatchingQuestion = {
    ...shared, type: 'matching', question: 'Associez.', points: 2,
    content: {
      left: [{ id: 'fr', label: 'France' }, { id: 'jp', label: 'Japon' }],
      right: [{ id: 'paris', label: 'Paris' }, { id: 'tokyo', label: 'Tokyo' }],
      correctPairs: { fr: 'paris', jp: 'tokyo' },
    },
  }

  it('is correct when every pair matches', () => expect(isCorrect(question, ['fr:paris', 'jp:tokyo'])).toBe(true))
  it('is incorrect when a pair is swapped', () => expect(isCorrect(question, ['fr:tokyo', 'jp:paris'])).toBe(false))
  it('is incorrect when incomplete', () => expect(isCorrect(question, ['fr:paris'])).toBe(false))
  it('is incorrect when unanswered', () => expect(isCorrect(question, undefined)).toBe(false))
  it('reports all correct pairs as labels', () => expect(correctAnswer(question)).toBe('France → Paris, Japon → Tokyo'))
  it('reports only the pairs the user made', () => expect(userAnswer(question, ['fr:tokyo'])).toBe('France → Tokyo'))
  it('reports no answer when nothing was paired', () => {
    expect(userAnswer(question, undefined)).toBe('Aucune réponse')
    expect(userAnswer(question, [])).toBe('Aucune réponse')
  })
})

describe('numeric', () => {
  const withUnit: NumericQuestion = { ...shared, type: 'numeric', question: 'Combien ?', points: 2, content: { min: 0, max: 100, step: 1, target: 50, tolerance: 5, unit: 'km' } }
  const noUnit: NumericQuestion = { ...shared, type: 'numeric', question: 'Combien ?', points: 2, content: { min: 0, max: 100, step: 1, target: 50, tolerance: 0 } }

  it('is correct within tolerance, inclusive of the boundary', () => {
    expect(isCorrect(withUnit, '50')).toBe(true)
    expect(isCorrect(withUnit, '55')).toBe(true)
    expect(isCorrect(withUnit, '45')).toBe(true)
  })
  it('is incorrect just outside the tolerance', () => {
    expect(isCorrect(withUnit, '56')).toBe(false)
    expect(isCorrect(withUnit, '44')).toBe(false)
  })
  it('is incorrect when unanswered', () => {
    expect(isCorrect(withUnit, '')).toBe(false)
    expect(isCorrect(withUnit, undefined)).toBe(false)
  })
  it('reports the correct answer with the tolerance and unit', () => expect(correctAnswer(withUnit)).toBe('50 km (± 5 km)'))
  it('omits the tolerance suffix when it is zero', () => expect(correctAnswer(noUnit)).toBe('50'))
  it('reports the given value with its unit', () => expect(userAnswer(withUnit, '42')).toBe('42 km'))
  it('reports the given value without a unit when none is set', () => expect(userAnswer(noUnit, '42')).toBe('42'))
  it('reports no answer when unanswered', () => {
    expect(userAnswer(withUnit, undefined)).toBe('Aucune réponse')
    expect(userAnswer(withUnit, '')).toBe('Aucune réponse')
  })
})
