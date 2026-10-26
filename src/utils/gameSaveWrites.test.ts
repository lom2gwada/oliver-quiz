import { beforeEach, describe, expect, it, vi } from 'vitest'

const { upsert, from } = vi.hoisted(() => {
  const upsert = vi.fn()
  return { upsert, from: vi.fn(() => ({ upsert })) }
})
vi.mock('./supabase', () => ({ supabase: { from, auth: { refreshSession: vi.fn() } } }))

import type { QCMQuestion } from '../types/quiz'
import { buildQuestionResultPayloads, buildQuizResultPayload, buildStreakResultPayload, buildTimedResultPayload, saveQuestionResults, saveQuizResult, saveStreakResult, saveTimedResult } from './quizHistory'

const question: QCMQuestion = {
  id: 'q1', type: 'qcm', category: 'histoire', difficulty: 'easy', points: 1, question: 'Q ?', tags: [], explanation: '',
  content: { multiple: false, answers: [{ id: 'a', label: 'A', isCorrect: true }, { id: 'b', label: 'B', isCorrect: false }] },
}
const categories = [{ id: 'histoire', label: 'Histoire' }]

describe('game save writes', () => {
  beforeEach(() => { vi.clearAllMocks(); upsert.mockResolvedValue({ error: null }) })

  it.each([
    ['quiz_results', () => saveQuizResult(buildQuizResultPayload([question], { q1: ['a'] }, categories, 5, 'Quiz', null, true))],
    ['question_results', () => saveQuestionResults(buildQuestionResultPayloads([question], { q1: ['a'] }, 'Quiz', null))],
    ['streak_results', () => saveStreakResult(buildStreakResultPayload(1, 5, false, [question], categories, 'Quiz', null, true))],
    ['timed_results', () => saveTimedResult(buildTimedResultPayload([{ question, answer: ['a'] }], 5, 60, categories, 'Quiz', null, true))],
  ])('writes %s by client-provided id, ignoring duplicates, so a replay never creates a second row', async (table, save) => {
    await save()
    expect(from).toHaveBeenCalledWith(table)
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: 'id', ignoreDuplicates: true })
  })

  it('throws the database error instead of swallowing it, so the caller can retry and warn the player', async () => {
    upsert.mockResolvedValue({ error: { code: '500', message: 'down' } })
    await expect(saveQuizResult(buildQuizResultPayload([question], {}, categories, 0, 'Quiz', null, true))).rejects.toMatchObject({ message: 'down' })
    await expect(saveStreakResult(buildStreakResultPayload(0, 0, false, [], categories, 'Quiz', null, true))).rejects.toBeDefined()
  })

  it('sends the very same id when the same payload is written again', async () => {
    const payload = buildQuizResultPayload([question], { q1: ['a'] }, categories, 5, 'Quiz', null, true)
    await saveQuizResult(payload)
    await saveQuizResult(payload)
    expect(upsert.mock.calls[0][0].id).toBe(upsert.mock.calls[1][0].id)
  })

  it('does not call the database for a game without any question detail', async () => {
    await saveQuestionResults([])
    expect(from).not.toHaveBeenCalled()
  })

  it('gives every built payload, and every question row, its own id', () => {
    const ids = [
      buildQuizResultPayload([question], {}, categories, 0, 'Quiz', null, true).id,
      buildQuizResultPayload([question], {}, categories, 0, 'Quiz', null, true).id,
      ...buildQuestionResultPayloads([question, { ...question, id: 'q2' }], {}, 'Quiz', null).map((row) => row.id),
    ]
    expect(ids.every((id) => /^[0-9a-f-]{36}$/.test(id))).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
