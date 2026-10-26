import { beforeEach, describe, expect, it, vi } from 'vitest'

const { upsert, fetchRows } = vi.hoisted(() => ({ upsert: vi.fn(), fetchRows: vi.fn() }))
vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => fetchRows() }),
      upsert,
    }),
  },
}))

import type { BooleanQuestion } from '../types/quiz'
import { createQuestionProgressJob } from './leitner'

const bool = (id: string, isTrue: boolean): BooleanQuestion => ({
  id, type: 'boolean', category: 'c', difficulty: 'easy', points: 1, question: 'Vrai ?', tags: [], explanation: '', content: { isTrue },
})

describe('createQuestionProgressJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchRows.mockResolvedValue({ data: [{ quiz_id: 'quiz', question_id: 'q1', box: 2, due_at: '2026-01-01T00:00:00Z' }], error: null })
    upsert.mockResolvedValue({ error: null })
  })

  const questions = [bool('q1', true), bool('q2', true)]
  const answers = { q1: ['true'], q2: ['false'] } // q1 juste, q2 ratée

  it('moves a correct card up one box and sends a missed or new one back to box 1', async () => {
    await createQuestionProgressJob('quiz', questions, answers)()
    const sent = upsert.mock.calls[0][0] as { question_id: string; box: number }[]
    expect(sent.map(({ question_id, box }) => [question_id, box])).toEqual([['q1', 3], ['q2', 1]])
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id,quiz_id,question_id' })
  })

  it('throws when the write fails so the caller can retry and warn the player', async () => {
    upsert.mockResolvedValue({ error: { message: 'rls' } })
    await expect(createQuestionProgressJob('quiz', questions, answers)()).rejects.toMatchObject({ message: 'rls' })
  })

  it('replays the same payload after a failed write instead of advancing the boxes a second time', async () => {
    upsert.mockResolvedValueOnce({ error: { message: 'network' } })
    const job = createQuestionProgressJob('quiz', questions, answers)
    await expect(job()).rejects.toBeDefined()
    // Le serveur a pu enregistrer la première écriture malgré l'erreur : la boîte de q1 y vaut déjà 3.
    fetchRows.mockResolvedValue({ data: [{ quiz_id: 'quiz', question_id: 'q1', box: 3, due_at: '2026-01-01T00:00:00Z' }], error: null })
    await job()
    expect(fetchRows).toHaveBeenCalledTimes(1)
    expect(upsert.mock.calls[1][0]).toEqual(upsert.mock.calls[0][0])
    expect((upsert.mock.calls[1][0] as { box: number }[])[0].box).toBe(3)
  })

  it('reads the current boxes again when it was the read that failed', async () => {
    fetchRows.mockResolvedValueOnce({ data: null, error: { message: 'timeout' } })
    const job = createQuestionProgressJob('quiz', questions, answers)
    await expect(job()).rejects.toBeDefined()
    await job()
    expect(fetchRows).toHaveBeenCalledTimes(2)
    expect(upsert).toHaveBeenCalledTimes(1)
  })
})
