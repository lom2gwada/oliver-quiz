import { describe, expect, it } from 'vitest'
import type { BooleanQuestion, QCMQuestion } from '../types/quiz'
import { computeDueQuestions, MAX_BOX, nextBox } from './leitner'

const qcm: QCMQuestion = {
  id: 'q1', theme: 'histoire', difficulty: 'easy', tags: [], explanation: '', points: 1,
  type: 'qcm', question: 'Q ?',
  content: { multiple: false, answers: [{ id: 'a', label: 'A', isCorrect: true }, { id: 'b', label: 'B', isCorrect: false }] },
}
const bool: BooleanQuestion = {
  id: 'q2', theme: 'geo', difficulty: 'medium', tags: [], explanation: '', points: 2,
  type: 'boolean', question: 'Vrai ou faux ?', content: { isTrue: true },
}

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

describe('nextBox', () => {
  it('advances by one box on a correct answer', () => {
    expect(nextBox(1, true)).toBe(2)
    expect(nextBox(3, true)).toBe(4)
  })

  it('caps at the highest box', () => {
    expect(nextBox(MAX_BOX, true)).toBe(MAX_BOX)
  })

  it('resets to box 1 on a wrong answer, regardless of the current box', () => {
    expect(nextBox(4, false)).toBe(1)
    expect(nextBox(1, false)).toBe(1)
  })
})

describe('computeDueQuestions', () => {
  it('includes a card whose due date has passed', () => {
    const progress = [{ quiz_id: 'quiz-1', question_id: 'q1', box: 1, due_at: inDays(-1) }]
    const due = computeDueQuestions(progress, [qcm, bool])
    expect(due).toEqual([{ question: qcm, box: 1 }])
  })

  it('excludes a card not due yet', () => {
    const progress = [{ quiz_id: 'quiz-1', question_id: 'q1', box: 2, due_at: inDays(5) }]
    expect(computeDueQuestions(progress, [qcm, bool])).toEqual([])
  })

  it('excludes progress for a question no longer in the quiz', () => {
    const progress = [{ quiz_id: 'quiz-1', question_id: 'deleted-question', box: 1, due_at: inDays(-1) }]
    expect(computeDueQuestions(progress, [qcm, bool])).toEqual([])
  })

  it('sorts the lowest box (most fragile) first', () => {
    const progress = [
      { quiz_id: 'quiz-1', question_id: 'q1', box: 3, due_at: inDays(-1) },
      { quiz_id: 'quiz-1', question_id: 'q2', box: 1, due_at: inDays(-1) },
    ]
    expect(computeDueQuestions(progress, [qcm, bool]).map((card) => card.question.id)).toEqual(['q2', 'q1'])
  })

  it('breaks a tie within the same box by the earliest due date', () => {
    const progress = [
      { quiz_id: 'quiz-1', question_id: 'q1', box: 1, due_at: inDays(-1) },
      { quiz_id: 'quiz-1', question_id: 'q2', box: 1, due_at: inDays(-3) },
    ]
    expect(computeDueQuestions(progress, [qcm, bool]).map((card) => card.question.id)).toEqual(['q2', 'q1'])
  })
})
