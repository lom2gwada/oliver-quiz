import { describe, expect, it } from 'vitest'
import type { BooleanQuestion, QCMQuestion, Theme } from '../types/quiz'
import type { QuizResultRow } from '../types/history'
import { bucketsToChartGroups, buildQuizResultPayload, computeRecords, sumBuckets } from './quizHistory'

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
    const payload = buildQuizResultPayload([qcm, bool], { q1: ['a'], q2: ['true'] }, themes, 42, 'Culture générale')
    expect(payload.score).toBe(100)
    expect(payload.earned_points).toBe(3)
    expect(payload.total_points).toBe(3)
    expect(payload.elapsed_seconds).toBe(42)
    expect(payload.question_count).toBe(2)
    expect(payload.quiz_title).toBe('Culture générale')
  })

  it('computes a partial score when some answers are wrong', () => {
    const payload = buildQuizResultPayload([qcm, bool], { q1: ['b'], q2: ['true'] }, themes, 0, 'Culture générale')
    expect(payload.score).toBe(67)
    expect(payload.earned_points).toBe(2)
  })

  it('resolves theme ids to labels and dedupes them', () => {
    const payload = buildQuizResultPayload([qcm, bool], {}, themes, 0, 'Culture générale')
    expect(payload.themes).toEqual(['Histoire', 'Géographie'])
  })

  it('falls back to the raw id when a theme is unknown', () => {
    const orphan: QCMQuestion = { ...qcm, id: 'q3', theme: 'unknown' }
    const payload = buildQuizResultPayload([orphan], {}, themes, 0, 'Culture générale')
    expect(payload.themes).toEqual(['unknown'])
  })

  it('aggregates correctness by theme, type and difficulty', () => {
    const payload = buildQuizResultPayload([qcm, bool], { q1: ['a'], q2: ['false'] }, themes, 0, 'Culture générale')
    expect(payload.by_theme).toEqual({ Histoire: { correct: 1, total: 1 }, Géographie: { correct: 0, total: 1 } })
    expect(payload.by_type).toEqual({ qcm: { correct: 1, total: 1 }, boolean: { correct: 0, total: 1 } })
    expect(payload.by_difficulty).toEqual({ easy: { correct: 1, total: 1 }, medium: { correct: 0, total: 1 } })
  })

  it('returns a score of 0 for an empty question set', () => {
    const payload = buildQuizResultPayload([], {}, themes, 0, 'Culture générale')
    expect(payload.score).toBe(0)
    expect(payload.themes).toEqual([])
  })

  it('tags the payload with the given quiz title', () => {
    expect(buildQuizResultPayload([qcm], {}, themes, 0, 'Test technique IT').quiz_title).toBe('Test technique IT')
  })
})

function row(overrides: Partial<QuizResultRow>): QuizResultRow {
  return {
    id: '1', created_at: '2026-01-01T00:00:00Z', quiz_title: 'Culture générale', score: 50, earned_points: 1, total_points: 2,
    elapsed_seconds: 60, question_count: 2, themes: [], by_theme: {}, by_type: {}, by_difficulty: {},
    ...overrides,
  }
}

describe('computeRecords', () => {
  it('returns zeroed records for an empty history', () => {
    expect(computeRecords([])).toEqual({ gamesPlayed: 0, bestScore: 0, averageScore: 0, totalPlaytimeSeconds: 0 })
  })

  it('counts games played', () => {
    expect(computeRecords([row({}), row({}), row({})]).gamesPlayed).toBe(3)
  })

  it('finds the best score regardless of row order', () => {
    expect(computeRecords([row({ score: 40 }), row({ score: 90 }), row({ score: 70 })]).bestScore).toBe(90)
  })

  it('rounds the average score', () => {
    expect(computeRecords([row({ score: 40 }), row({ score: 41 })]).averageScore).toBe(41)
  })

  it('sums total playtime across all games', () => {
    expect(computeRecords([row({ elapsed_seconds: 30 }), row({ elapsed_seconds: 45 })]).totalPlaytimeSeconds).toBe(75)
  })
})

describe('sumBuckets', () => {
  it('sums correct/total across every row for the same key', () => {
    const rows = [
      row({ by_theme: { Histoire: { correct: 1, total: 2 } } }),
      row({ by_theme: { Histoire: { correct: 2, total: 3 } } }),
    ]
    expect(sumBuckets(rows, (r) => r.by_theme)).toEqual({ Histoire: { correct: 3, total: 5 } })
  })

  it('keeps separate keys separate', () => {
    const rows = [
      row({ by_theme: { Histoire: { correct: 1, total: 1 } } }),
      row({ by_theme: { Géographie: { correct: 0, total: 1 } } }),
    ]
    expect(sumBuckets(rows, (r) => r.by_theme)).toEqual({
      Histoire: { correct: 1, total: 1 },
      Géographie: { correct: 0, total: 1 },
    })
  })

  it('returns an empty object for an empty history', () => {
    expect(sumBuckets([], (r) => r.by_theme)).toEqual({})
  })
})

describe('bucketsToChartGroups', () => {
  it('splits each bucket into a Réussi/Raté pie slice pair', () => {
    const groups = bucketsToChartGroups({ Histoire: { correct: 3, total: 5 } }, (key) => key)
    expect(groups).toEqual([{
      key: 'Histoire', label: 'Histoire',
      data: [{ label: 'Réussi', value: 3, color: '#34d399' }, { label: 'Raté', value: 2, color: '#fb7185' }],
    }])
  })

  it('omits a slice when its value is zero', () => {
    const perfect = bucketsToChartGroups({ Histoire: { correct: 4, total: 4 } }, (key) => key)
    expect(perfect[0].data).toEqual([{ label: 'Réussi', value: 4, color: '#34d399' }])
  })

  it('applies the label resolver to each key', () => {
    const groups = bucketsToChartGroups({ qcm: { correct: 1, total: 1 } }, () => 'QCM')
    expect(groups[0].label).toBe('QCM')
  })
})
