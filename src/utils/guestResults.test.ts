import { describe, expect, it } from 'vitest'
import type { GuestResultRow } from '../types/guestLink'
import type { BooleanQuestion, QCMQuestion, TextQuestion } from '../types/quiz'
import { computeQuestionCorrectness, summarizeGuestResults, tallyAnswers } from './guestResults'

const t = (key: string) => key as never

const qcm: QCMQuestion = {
  id: 'q1', theme: 'x', difficulty: 'easy', tags: [], explanation: '', points: 1, type: 'qcm', question: 'Q ?',
  content: { multiple: false, answers: [{ id: 'a', label: 'A', isCorrect: true }, { id: 'b', label: 'B', isCorrect: false }, { id: 'c', label: 'C', isCorrect: false }] },
}
const bool: BooleanQuestion = { id: 'q2', theme: 'x', difficulty: 'easy', tags: [], explanation: '', points: 1, type: 'boolean', question: 'V/F ?', content: { isTrue: true } }
const text: TextQuestion = { id: 'q3', theme: 'x', difficulty: 'easy', tags: [], explanation: '', points: 1, type: 'text', question: 'Nom ?', content: { expectedAnswers: ['paris'], caseSensitive: false } }

const result = (overrides: Partial<GuestResultRow>): GuestResultRow => ({
  id: '1', respondent_name: 'X', created_at: '2026-09-19T10:00:00Z', answers: {}, score: null, elapsed_seconds: 60, ...overrides,
})

describe('summarizeGuestResults', () => {
  it('returns zeros and a null average for no responses', () => {
    expect(summarizeGuestResults([])).toEqual({ count: 0, averageScore: null, averageSeconds: 0 })
  })

  it('averages scores and durations, rounded', () => {
    const summary = summarizeGuestResults([result({ score: 50, elapsed_seconds: 30 }), result({ score: 75, elapsed_seconds: 61 })])
    expect(summary).toEqual({ count: 2, averageScore: 63, averageSeconds: 46 })
  })

  it('has no average score for survey responses (null scores)', () => {
    expect(summarizeGuestResults([result({}), result({})]).averageScore).toBeNull()
  })
})

describe('computeQuestionCorrectness', () => {
  it('counts the respondents who got each question right', () => {
    const rows = [
      result({ answers: { q1: ['a'], q2: ['true'] } }),
      result({ answers: { q1: ['b'], q2: ['true'] } }),
      result({ answers: {} }),
    ]
    const [first, second] = computeQuestionCorrectness(rows, [qcm, bool])
    expect(first).toMatchObject({ correct: 1, total: 3 })
    expect(second).toMatchObject({ correct: 2, total: 3 })
  })
})

describe('tallyAnswers', () => {
  it('lists every option of a choice question, including unchosen ones and non-answers', () => {
    const rows = [result({ answers: { q1: ['a'] } }), result({ answers: { q1: ['a'] } }), result({ answers: { q1: ['b'] } }), result({})]
    expect(tallyAnswers(qcm, rows, t)).toEqual([
      { label: 'A', count: 2 }, { label: 'B', count: 1 }, { label: 'C', count: 0 }, { label: 'quiz.noAnswer', count: 1 },
    ])
  })

  it('counts identical free answers and sorts the most frequent first', () => {
    const rows = [result({ answers: { q3: 'Lyon' } }), result({ answers: { q3: 'Paris' } }), result({ answers: { q3: 'Lyon' } })]
    expect(tallyAnswers(text, rows, t)).toEqual([{ label: 'Lyon', count: 2 }, { label: 'Paris', count: 1 }])
  })

  it('tallies a boolean question through its readable answer', () => {
    const rows = [result({ answers: { q2: ['true'] } }), result({ answers: { q2: ['false'] } }), result({ answers: { q2: ['true'] } })]
    expect(tallyAnswers(bool, rows, t)).toEqual([{ label: 'quiz.true', count: 2 }, { label: 'quiz.false', count: 1 }])
  })

  it('keeps only the most frequent free answers', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'a'].map((value) => result({ answers: { q3: value } }))
    const tally = tallyAnswers(text, rows, t)
    expect(tally).toHaveLength(5)
    expect(tally[0]).toEqual({ label: 'a', count: 2 })
  })
})
