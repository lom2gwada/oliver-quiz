import { describe, expect, it } from 'vitest'
import type { BooleanQuestion, QCMQuestion, Theme } from '../types/quiz'
import type { QuestionResultRow, QuizResultRow } from '../types/history'
import { bucketsToChartGroups, bucketsToRadarAxes, buildQuestionResultPayloads, buildQuizResultPayload, buildStreakResultPayload, buildTimedResultPayload, computeMissedQuestions, computeRecords, computeThemeWeekHeatmap, sumBuckets, weekStartKey } from './quizHistory'

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
    const payload = buildQuizResultPayload([qcm, bool], { q1: ['a'], q2: ['true'] }, themes, 42, 'Culture générale', null, true)
    expect(payload.score).toBe(100)
    expect(payload.earned_points).toBe(3)
    expect(payload.total_points).toBe(3)
    expect(payload.elapsed_seconds).toBe(42)
    expect(payload.question_count).toBe(2)
    expect(payload.correct_count).toBe(2)
    expect(payload.quiz_title).toBe('Culture générale')
  })

  it('computes a partial score when some answers are wrong', () => {
    const payload = buildQuizResultPayload([qcm, bool], { q1: ['b'], q2: ['true'] }, themes, 0, 'Culture générale', null, true)
    expect(payload.score).toBe(67)
    expect(payload.earned_points).toBe(2)
    expect(payload.correct_count).toBe(1)
  })

  it('resolves theme ids to labels and dedupes them', () => {
    const payload = buildQuizResultPayload([qcm, bool], {}, themes, 0, 'Culture générale', null, true)
    expect(payload.themes).toEqual(['Histoire', 'Géographie'])
  })

  it('falls back to the raw id when a theme is unknown', () => {
    const orphan: QCMQuestion = { ...qcm, id: 'q3', theme: 'unknown' }
    const payload = buildQuizResultPayload([orphan], {}, themes, 0, 'Culture générale', null, true)
    expect(payload.themes).toEqual(['unknown'])
  })

  it('aggregates correctness by theme, type and difficulty', () => {
    const payload = buildQuizResultPayload([qcm, bool], { q1: ['a'], q2: ['false'] }, themes, 0, 'Culture générale', null, true)
    expect(payload.by_theme).toEqual({ Histoire: { correct: 1, total: 1 }, Géographie: { correct: 0, total: 1 } })
    expect(payload.by_type).toEqual({ qcm: { correct: 1, total: 1 }, boolean: { correct: 0, total: 1 } })
    expect(payload.by_difficulty).toEqual({ easy: { correct: 1, total: 1 }, medium: { correct: 0, total: 1 } })
  })

  it('returns a score of 0 for an empty question set', () => {
    const payload = buildQuizResultPayload([], {}, themes, 0, 'Culture générale', null, true)
    expect(payload.score).toBe(0)
    expect(payload.themes).toEqual([])
  })

  it('tags the payload with the given quiz title', () => {
    expect(buildQuizResultPayload([qcm], {}, themes, 0, 'Test technique IT', null, true).quiz_title).toBe('Test technique IT')
  })

  it('tags the payload with the given quiz id', () => {
    expect(buildQuizResultPayload([qcm], {}, themes, 0, 'Culture générale', 'quiz-1', true).quiz_id).toBe('quiz-1')
  })

  it('records whether the run was played without any theme/difficulty filter', () => {
    expect(buildQuizResultPayload([qcm], {}, themes, 0, 'Culture générale', null, true).unfiltered).toBe(true)
    expect(buildQuizResultPayload([qcm], {}, themes, 0, 'Culture générale', null, false).unfiltered).toBe(false)
  })
})

describe('buildStreakResultPayload', () => {
  it('builds a payload with resolved, deduped theme labels', () => {
    const payload = buildStreakResultPayload(7, 120, false, [qcm, bool, qcm], themes, 'Culture générale', null, true)
    expect(payload).toEqual({
      quiz_title: 'Culture générale', quiz_id: null, streak_count: 7, elapsed_seconds: 120, victory: false,
      themes: ['Histoire', 'Géographie'], unfiltered: true,
    })
  })

  it('falls back to the raw id when a theme is unknown', () => {
    const orphan: QCMQuestion = { ...qcm, id: 'q3', theme: 'unknown' }
    const payload = buildStreakResultPayload(0, 0, false, [orphan], themes, 'Culture générale', null, true)
    expect(payload.themes).toEqual(['unknown'])
  })

  it('marks a full clear as a victory', () => {
    expect(buildStreakResultPayload(74, 300, true, [], themes, 'Culture générale', null, true).victory).toBe(true)
  })

  it('records whether the run was played without any theme/difficulty filter', () => {
    expect(buildStreakResultPayload(1, 0, false, [], themes, 'Culture générale', null, false).unfiltered).toBe(false)
  })
})

describe('buildTimedResultPayload', () => {
  it('counts correct attempts and resolves deduped theme labels', () => {
    const payload = buildTimedResultPayload(
      [{ question: qcm, answer: ['a'] }, { question: bool, answer: ['false'] }, { question: qcm, answer: ['a'] }],
      300, 300, themes, 'Culture générale', null, true,
    )
    expect(payload).toEqual({
      quiz_title: 'Culture générale', quiz_id: null, correct_count: 2, question_count: 3,
      duration_seconds: 300, elapsed_seconds: 300, themes: ['Histoire', 'Géographie'], unfiltered: true,
    })
  })

  it('counts a question answered more than once as separate attempts', () => {
    const payload = buildTimedResultPayload([{ question: qcm, answer: ['a'] }, { question: qcm, answer: ['b'] }], 60, 300, themes, 'Culture générale', null, true)
    expect(payload.question_count).toBe(2)
    expect(payload.correct_count).toBe(1)
  })

  it('marks an unlimited-duration run with duration_seconds 0', () => {
    expect(buildTimedResultPayload([], 45, 0, themes, 'Culture générale', null, true).duration_seconds).toBe(0)
  })

  it('falls back to the raw id when a theme is unknown', () => {
    const orphan: QCMQuestion = { ...qcm, id: 'q3', theme: 'unknown' }
    const payload = buildTimedResultPayload([{ question: orphan, answer: undefined }], 0, 60, themes, 'Culture générale', null, true)
    expect(payload.themes).toEqual(['unknown'])
    expect(payload.correct_count).toBe(0)
  })

  it('records whether the run was played without any theme/difficulty filter', () => {
    expect(buildTimedResultPayload([], 0, 60, themes, 'Culture générale', null, false).unfiltered).toBe(false)
  })
})

function row(overrides: Partial<QuizResultRow>): QuizResultRow {
  return {
    id: '1', created_at: '2026-01-01T00:00:00Z', quiz_title: 'Culture générale', quiz_id: null, score: 50, earned_points: 1, total_points: 2,
    elapsed_seconds: 60, question_count: 2, correct_count: 1, themes: [], by_theme: {}, by_type: {}, by_difficulty: {}, unfiltered: true,
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

describe('weekStartKey', () => {
  it('returns the Monday of the week, including for a Sunday', () => {
    expect(weekStartKey(new Date(2026, 8, 16))).toBe('2026-09-14') // mercredi
    expect(weekStartKey(new Date(2026, 8, 14))).toBe('2026-09-14') // lundi
    expect(weekStartKey(new Date(2026, 8, 20))).toBe('2026-09-14') // dimanche
  })

  it('crosses month and year boundaries', () => {
    expect(weekStartKey(new Date(2026, 0, 1))).toBe('2025-12-29')
  })
})

describe('computeThemeWeekHeatmap', () => {
  const at = (iso: string, by_theme: QuizResultRow['by_theme']) => row({ created_at: iso, by_theme })

  it('returns an empty grid for no history', () => {
    expect(computeThemeWeekHeatmap([])).toEqual({ weeks: [], themes: [], truncated: false })
  })

  it('sums games of the same week and leaves unplayed cells null', () => {
    const heatmap = computeThemeWeekHeatmap([
      at('2026-09-15T10:00:00', { Histoire: { correct: 1, total: 2 }, Sport: { correct: 1, total: 1 } }),
      at('2026-09-16T10:00:00', { Histoire: { correct: 2, total: 2 } }),
      at('2026-09-23T10:00:00', { Sport: { correct: 0, total: 1 } }),
    ])
    expect(heatmap.weeks).toEqual(['2026-09-14', '2026-09-21'])
    expect(heatmap.themes).toEqual([
      { label: 'Histoire', cells: [{ correct: 3, total: 4 }, null] },
      { label: 'Sport', cells: [{ correct: 1, total: 1 }, { correct: 0, total: 1 }] },
    ])
  })

  it('keeps only the most recent weeks', () => {
    const rows = ['2026-09-01', '2026-09-08', '2026-09-15'].map((day) => at(`${day}T10:00:00`, { A: { correct: 1, total: 1 } }))
    expect(computeThemeWeekHeatmap(rows, 2).weeks).toEqual(['2026-09-07', '2026-09-14'])
  })

  it('caps the number of themes to the most played and flags truncation', () => {
    const heatmap = computeThemeWeekHeatmap([at('2026-09-15T10:00:00', { A: { correct: 1, total: 1 }, B: { correct: 1, total: 5 }, C: { correct: 1, total: 3 } })], 12, 2)
    expect(heatmap.themes.map((theme) => theme.label)).toEqual(['B', 'C'])
    expect(heatmap.truncated).toBe(true)
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

describe('bucketsToRadarAxes', () => {
  it('turns each bucket into a success-rate axis', () => {
    const axes = bucketsToRadarAxes({ Histoire: { correct: 3, total: 5 }, Géo: { correct: 2, total: 2 } }, (key) => key)
    expect(axes).toEqual([
      { key: 'Histoire', label: 'Histoire', value: 60 },
      { key: 'Géo', label: 'Géo', value: 100 },
    ])
  })

  it('treats an empty bucket as a 0% axis rather than dividing by zero', () => {
    const axes = bucketsToRadarAxes({ Histoire: { correct: 0, total: 0 } }, (key) => key)
    expect(axes[0].value).toBe(0)
  })

  it('sorts by attempt volume and caps at maxAxes', () => {
    const buckets = { A: { correct: 1, total: 1 }, B: { correct: 1, total: 10 }, C: { correct: 1, total: 5 } }
    const axes = bucketsToRadarAxes(buckets, (key) => key, 2)
    expect(axes.map((axis) => axis.key)).toEqual(['B', 'C'])
  })
})

describe('buildQuestionResultPayloads', () => {
  it('tags each question with its own correctness', () => {
    const payloads = buildQuestionResultPayloads([qcm, bool], { q1: ['a'], q2: ['false'] }, 'Culture générale', null)
    expect(payloads).toEqual([
      { quiz_title: 'Culture générale', quiz_id: null, question_id: 'q1', question_text: 'Q ?', correct: true },
      { quiz_title: 'Culture générale', quiz_id: null, question_id: 'q2', question_text: 'Vrai ou faux ?', correct: false },
    ])
  })

  it('marks an unanswered question as incorrect', () => {
    const [payload] = buildQuestionResultPayloads([qcm], {}, 'Culture générale', null)
    expect(payload.correct).toBe(false)
  })

  it('returns an empty array for no questions', () => {
    expect(buildQuestionResultPayloads([], {}, 'Culture générale', null)).toEqual([])
  })
})

function questionRow(overrides: Partial<QuestionResultRow>): QuestionResultRow {
  return {
    id: '1', created_at: '2026-01-01T00:00:00Z', quiz_title: 'Culture générale', quiz_id: null,
    question_id: 'q1', question_text: 'Q ?', correct: true,
    ...overrides,
  }
}

describe('computeMissedQuestions', () => {
  it('counts wrong attempts per question', () => {
    const rows = [
      questionRow({ correct: false }),
      questionRow({ correct: true }),
      questionRow({ correct: false }),
    ]
    const [missed] = computeMissedQuestions(rows, 'Culture générale', null)
    expect(missed).toEqual({ questionId: 'q1', questionText: 'Q ?', attempts: 3, wrongCount: 2 })
  })

  it('excludes questions that were always answered correctly', () => {
    const rows = [questionRow({ correct: true }), questionRow({ correct: true })]
    expect(computeMissedQuestions(rows, 'Culture générale', null)).toEqual([])
  })

  it('sorts by wrong count, most missed first', () => {
    const rows = [
      questionRow({ question_id: 'q1', correct: false }),
      questionRow({ question_id: 'q2', correct: false }),
      questionRow({ question_id: 'q2', correct: false }),
    ]
    const missed = computeMissedQuestions(rows, 'Culture générale', null)
    expect(missed.map((entry) => entry.questionId)).toEqual(['q2', 'q1'])
  })

  it('ignores rows from other quizzes', () => {
    const rows = [questionRow({ quiz_title: 'Autre quiz', correct: false })]
    expect(computeMissedQuestions(rows, 'Culture générale', null)).toEqual([])
  })

  it('prefers matching by quiz_id over the frozen title when both are known', () => {
    const rows = [questionRow({ quiz_id: 'quiz-1', quiz_title: 'Ancien titre', correct: false })]
    expect(computeMissedQuestions(rows, 'Nouveau titre', 'quiz-1')).toHaveLength(1)
    expect(computeMissedQuestions(rows, 'Nouveau titre', 'quiz-2')).toEqual([])
  })

  it('returns an empty array for no history', () => {
    expect(computeMissedQuestions([], 'Culture générale', null)).toEqual([])
  })

  const at = (iso: string, correct: boolean) => questionRow({ created_at: iso, correct })

  it('drops a question once its 5 most recent attempts are majority correct, even with a heavy wrong history', () => {
    const rows = [
      at('2026-01-01T00:00:00Z', false), at('2026-01-02T00:00:00Z', false), at('2026-01-03T00:00:00Z', false),
      at('2026-01-04T00:00:00Z', false), at('2026-01-05T00:00:00Z', false), at('2026-01-06T00:00:00Z', false),
      at('2026-02-01T00:00:00Z', true), at('2026-02-02T00:00:00Z', true), at('2026-02-03T00:00:00Z', true),
    ]
    expect(computeMissedQuestions(rows, 'Culture générale', null)).toEqual([])
  })

  it('keeps a question when its recent attempts are exactly half correct (not a strict majority)', () => {
    const rows = [at('2026-01-01T00:00:00Z', false), at('2026-01-02T00:00:00Z', true)]
    expect(computeMissedQuestions(rows, 'Culture générale', null)).toHaveLength(1)
  })

  it('ignores attempts older than the 5 most recent when judging mastery', () => {
    const rows = [
      at('2026-01-01T00:00:00Z', true), at('2026-01-02T00:00:00Z', true), at('2026-01-03T00:00:00Z', true), // ignored, outside the window
      at('2026-01-04T00:00:00Z', false), at('2026-01-05T00:00:00Z', false), at('2026-01-06T00:00:00Z', false), at('2026-01-07T00:00:00Z', false), at('2026-01-08T00:00:00Z', false),
    ]
    expect(computeMissedQuestions(rows, 'Culture générale', null)).toHaveLength(1)
  })
})
