import { describe, expect, it } from 'vitest'
import type { BooleanQuestion, CodeQuestion, MatchingQuestion, OrderingQuestion, QCMQuestion } from '../types/quiz'
import { questionTimeLimit } from './questionTimeLimits'

const boolQuestion: BooleanQuestion = {
  id: 'q1', theme: 'general', difficulty: 'easy', tags: [], explanation: '', points: 1,
  type: 'boolean', question: 'Vrai ou faux ?', content: { isTrue: true },
}
const matchingQuestion: MatchingQuestion = {
  id: 'q2', theme: 'general', difficulty: 'hard', tags: [], explanation: '', points: 2,
  type: 'matching', question: 'Associez.', content: { left: [], right: [], correctPairs: {} },
}

describe('questionTimeLimit', () => {
  it('uses the question\'s own override when set', () => {
    expect(questionTimeLimit({ ...boolQuestion, timeLimitSeconds: 5 })).toBe(5)
  })

  it('falls back to the default scale by type and difficulty when unset', () => {
    expect(questionTimeLimit(boolQuestion)).toBe(8)
    expect(questionTimeLimit(matchingQuestion)).toBe(45)
  })

  it('gives a longer default to interaction-heavy types than to a quick boolean at the same difficulty', () => {
    const easyMatching: MatchingQuestion = { ...matchingQuestion, difficulty: 'easy' }
    expect(questionTimeLimit(easyMatching)).toBeGreaterThan(questionTimeLimit(boolQuestion))
  })

  const shortQcm: QCMQuestion = {
    id: 'q3', theme: 'general', difficulty: 'medium', tags: [], explanation: '', points: 1,
    type: 'qcm', question: 'Capitale de la France ?',
    content: { multiple: false, answers: [{ id: 'a', label: 'Paris', isCorrect: true }, { id: 'b', label: 'Lyon', isCorrect: false }] },
  }

  it('leaves a short QCM at the plain default (no reading penalty for typical-length questions)', () => {
    expect(questionTimeLimit(shortQcm)).toBe(15)
  })

  it('adds reading time proportional to how far a QCM exceeds the typical length', () => {
    const longAnswer = 'x'.repeat(200)
    const longQcm: QCMQuestion = { ...shortQcm, content: { multiple: false, answers: [{ id: 'a', label: longAnswer, isCorrect: true }, { id: 'b', label: 'Lyon', isCorrect: false }] } }
    expect(questionTimeLimit(longQcm)).toBeGreaterThan(questionTimeLimit(shortQcm))
  })

  it('counts an ordering question\'s item labels, not just its prompt', () => {
    const shortOrdering: OrderingQuestion = {
      id: 'q4', theme: 'general', difficulty: 'medium', tags: [], explanation: '', points: 1,
      type: 'ordering', question: 'Ordonnez.', content: { items: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], correctOrder: ['a', 'b'] },
    }
    const longOrdering: OrderingQuestion = { ...shortOrdering, content: { ...shortOrdering.content, items: shortOrdering.content.items.map((item) => ({ ...item, label: item.label.repeat(100) })) } }
    expect(questionTimeLimit(longOrdering)).toBeGreaterThan(questionTimeLimit(shortOrdering))
  })

  it('counts a code question\'s snippet toward reading time', () => {
    const shortCode: CodeQuestion = {
      id: 'q5', theme: 'general', difficulty: 'medium', tags: [], explanation: '', points: 1,
      type: 'code', question: 'Que fait ce code ?',
      content: { language: 'js', snippet: 'x++', multiple: false, answers: [{ id: 'a', label: 'Incrémente x', isCorrect: true }, { id: 'b', label: 'Décrémente x', isCorrect: false }] },
    }
    const longCode: CodeQuestion = { ...shortCode, content: { ...shortCode.content, snippet: 'x++;\n'.repeat(60) } }
    expect(questionTimeLimit(longCode)).toBeGreaterThan(questionTimeLimit(shortCode))
  })

  it('still honors an explicit override even on a long question', () => {
    const longAnswer = 'x'.repeat(500)
    const overridden: QCMQuestion = { ...shortQcm, timeLimitSeconds: 7, content: { multiple: false, answers: [{ id: 'a', label: longAnswer, isCorrect: true }] } }
    expect(questionTimeLimit(overridden)).toBe(7)
  })
})
