import { describe, expect, it } from 'vitest'
import type { BooleanQuestion, QCMQuestion, Theme } from '../types/quiz'
import { buildQuizResultPayload } from './quizHistory'

const themes: Theme[] = [{ id: 'histoire', label: 'Histoire' }, { id: 'geo', label: 'Géographie' }]

const qcm: QCMQuestion = {
  id: 'q1', theme: 'histoire', difficulty: 'easy', tags: [], explanation: '', points: 1,
  type: 'qcm', question: 'Q ?',
  content: { multiple: false, answers: [{ id: 'a', label: 'A', isCorrect: true }, { id: 'b', label: 'B', isCorrect: false }] },
}
const bool: BooleanQuestion = {
  id: 'q2', theme: 'geo', difficulty: 'medium', tags: [], explanation: '', points: 2,
  type: 'boolean', question: 'Vrai ou faux ?', content: { isTrue: true },
}

describe('buildQuizResultPayload', () => {
  it('computes the score and point totals', () => {
    const payload = buildQuizResultPayload([qcm, bool], { q1: ['a'], q2: ['true'] }, themes, 42)
    expect(payload.score).toBe(100)
    expect(payload.earned_points).toBe(3)
    expect(payload.total_points).toBe(3)
    expect(payload.elapsed_seconds).toBe(42)
    expect(payload.question_count).toBe(2)
  })

  it('computes a partial score when some answers are wrong', () => {
    const payload = buildQuizResultPayload([qcm, bool], { q1: ['b'], q2: ['true'] }, themes, 0)
    expect(payload.score).toBe(67)
    expect(payload.earned_points).toBe(2)
  })

  it('resolves theme ids to labels and dedupes them', () => {
    const payload = buildQuizResultPayload([qcm, bool], {}, themes, 0)
    expect(payload.themes).toEqual(['Histoire', 'Géographie'])
  })

  it('falls back to the raw id when a theme is unknown', () => {
    const orphan: QCMQuestion = { ...qcm, id: 'q3', theme: 'unknown' }
    const payload = buildQuizResultPayload([orphan], {}, themes, 0)
    expect(payload.themes).toEqual(['unknown'])
  })

  it('aggregates correctness by theme, type and difficulty', () => {
    const payload = buildQuizResultPayload([qcm, bool], { q1: ['a'], q2: ['false'] }, themes, 0)
    expect(payload.by_theme).toEqual({ Histoire: { correct: 1, total: 1 }, Géographie: { correct: 0, total: 1 } })
    expect(payload.by_type).toEqual({ qcm: { correct: 1, total: 1 }, boolean: { correct: 0, total: 1 } })
    expect(payload.by_difficulty).toEqual({ easy: { correct: 1, total: 1 }, medium: { correct: 0, total: 1 } })
  })

  it('returns a score of 0 for an empty question set', () => {
    const payload = buildQuizResultPayload([], {}, themes, 0)
    expect(payload.score).toBe(0)
    expect(payload.themes).toEqual([])
  })
})
