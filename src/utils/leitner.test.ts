import { describe, expect, it } from 'vitest'
import type { BooleanQuestion, QCMQuestion } from '../types/quiz'
import { computeDueQuestions, MAX_BOX, nextBox, selectReviewQuestions } from './leitner'

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

describe('selectReviewQuestions', () => {
  const card = (index: number, box: number) => ({ question: { ...qcm, id: `q${index}` } as QCMQuestion, box })
  /** 6 cartes fragiles (boîte 1) puis 24 de la boîte 2, déjà triées par priorité comme le fait `computeDueQuestions`. */
  const due = [...Array.from({ length: 6 }, (_, index) => card(index, 1)), ...Array.from({ length: 24 }, (_, index) => card(index + 6, 2))]
  const ids = (questions: { id: string }[]) => questions.map((question) => question.id)

  it('never returns more questions than requested or than are due, without duplicates', () => {
    expect(selectReviewQuestions(due, 10)).toHaveLength(10)
    expect(selectReviewQuestions(due, 100)).toHaveLength(30)
    const selected = ids(selectReviewQuestions(due, 20))
    expect(new Set(selected).size).toBe(selected.length)
  })

  it('always includes the most fragile cards for the priority half', () => {
    for (let run = 0; run < 100; run += 1) {
      const selected = ids(selectReviewQuestions(due, 10))
      // la moitié de 10 = les 5 premières cartes triées par priorité, toujours présentes
      ;['q0', 'q1', 'q2', 'q3', 'q4'].forEach((id) => expect(selected).toContain(id))
    }
  })

  it('draws the other half at random among the remaining due cards, so the backlog comes back', () => {
    const seenFromTheRest = new Set<string>()
    for (let run = 0; run < 300; run += 1) {
      ids(selectReviewQuestions(due, 10)).filter((id) => Number(id.slice(1)) >= 5).forEach((id) => seenFromTheRest.add(id))
    }
    // sur 300 sessions, (presque) toutes les 25 cartes restantes ont fini par être proposées
    expect(seenFromTheRest.size).toBeGreaterThanOrEqual(23)
  })

  it('rounds the priority half up and handles an odd count', () => {
    for (let run = 0; run < 50; run += 1) {
      const selected = ids(selectReviewQuestions(due, 5))
      ;['q0', 'q1', 'q2'].forEach((id) => expect(selected).toContain(id))
      expect(selected).toHaveLength(5)
    }
  })

  it('shuffles the order of the session instead of starting with the most fragile card', () => {
    const firstCards = new Set<string>()
    for (let run = 0; run < 200; run += 1) firstCards.add(ids(selectReviewQuestions(due, 10))[0])
    expect(firstCards.size).toBeGreaterThan(3)
  })

  it('returns every due card (shuffled) when fewer are due than requested, and nothing when none are due', () => {
    expect(ids(selectReviewQuestions(due.slice(0, 4), 20)).sort()).toEqual(['q0', 'q1', 'q2', 'q3'])
    expect(selectReviewQuestions([], 20)).toEqual([])
  })
})
