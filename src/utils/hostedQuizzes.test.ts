import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
const single = vi.hoisted(() => vi.fn())
const eq = vi.hoisted(() => vi.fn(() => ({ single })))
const select = vi.hoisted(() => vi.fn(() => ({ eq })))
const from = vi.hoisted(() => vi.fn(() => ({ select })))
vi.mock('./supabase', () => ({ supabase: { rpc, from, auth: { refreshSession: vi.fn() } } }))

import { deleteQuiz, fetchQuizWithVersion, QuizConflictError, setQuizPublic, updateQuiz, upsertQuiz } from './hostedQuizzes'

beforeEach(() => { rpc.mockReset(); single.mockReset(); eq.mockClear(); select.mockClear(); from.mockClear() })

describe('fetchQuizWithVersion', () => {
  it('returns the content with its version, as Postgres wrote it', async () => {
    single.mockResolvedValue({ data: { content: { questions: [] }, updated_at: '2026-11-24T10:00:00.123456+00:00' }, error: null })
    await expect(fetchQuizWithVersion('q1')).resolves.toEqual({ content: { questions: [] }, updatedAt: '2026-11-24T10:00:00.123456+00:00' })
    expect(from).toHaveBeenCalledWith('quizzes')
    expect(select).toHaveBeenCalledWith('content, updated_at')
    expect(eq).toHaveBeenCalledWith('id', 'q1')
  })

  it('throws the database error', async () => {
    single.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(fetchQuizWithVersion('q1')).rejects.toThrow('boom')
  })
})

describe('upsertQuiz', () => {
  it('goes through upsert_quiz and returns the quiz id', async () => {
    rpc.mockResolvedValue({ data: 'quiz-id', error: null })
    await expect(upsertQuiz('Titre', { a: 1 })).resolves.toBe('quiz-id')
    expect(rpc).toHaveBeenCalledWith('upsert_quiz', { p_title: 'Titre', p_content: { a: 1 } })
  })

  it('throws what the database refuses', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } })
    await expect(upsertQuiz('Titre', {})).rejects.toEqual({ message: 'forbidden' })
  })
})

describe('updateQuiz', () => {
  it('sends the version the caller loaded and returns the new one', async () => {
    rpc.mockResolvedValue({ data: '2026-11-24T10:05:00.654321+00:00', error: null })
    await expect(updateQuiz('q1', 'Titre', { a: 1 }, '2026-11-24T10:00:00.123456+00:00')).resolves.toBe('2026-11-24T10:05:00.654321+00:00')
    expect(rpc).toHaveBeenCalledWith('update_quiz', { p_id: 'q1', p_title: 'Titre', p_content: { a: 1 }, p_expected_updated_at: '2026-11-24T10:00:00.123456+00:00' })
  })

  it('sends no version when it is not known: the save is then not checked', async () => {
    rpc.mockResolvedValue({ data: '2026-11-24T10:05:00+00:00', error: null })
    await updateQuiz('q1', 'Titre', {}, null)
    expect(rpc).toHaveBeenCalledWith('update_quiz', expect.objectContaining({ p_expected_updated_at: null }))
  })

  it('raises QuizConflictError when the quiz changed in the meantime', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'conflict' } })
    await expect(updateQuiz('q1', 'Titre', {}, 'v1')).rejects.toBeInstanceOf(QuizConflictError)
  })

  it('throws any other refusal as it is', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } })
    const failure = await updateQuiz('q1', 'Titre', {}, 'v1').catch((error) => error)
    expect(failure).not.toBeInstanceOf(QuizConflictError)
    expect(failure).toEqual({ message: 'forbidden' })
  })
})

describe('deleteQuiz', () => {
  it('keeps the history by default', async () => {
    rpc.mockResolvedValue({ data: {}, error: null })
    await deleteQuiz('q1')
    expect(rpc).toHaveBeenCalledWith('delete_quiz', { p_quiz_id: 'q1', p_purge_history: false })
  })

  it('purges the players’ history in the same operation when asked', async () => {
    rpc.mockResolvedValue({ data: {}, error: null })
    await deleteQuiz('q1', true)
    expect(rpc).toHaveBeenCalledWith('delete_quiz', { p_quiz_id: 'q1', p_purge_history: true })
  })

  it('throws when the caller is not an owner', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } })
    await expect(deleteQuiz('q1')).rejects.toEqual({ message: 'forbidden' })
  })
})

describe('setQuizPublic', () => {
  it('goes through set_quiz_public', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await setQuizPublic('q1', true)
    expect(rpc).toHaveBeenCalledWith('set_quiz_public', { p_quiz_id: 'q1', p_is_public: true })
  })

  it('throws when the caller is not an owner', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } })
    await expect(setQuizPublic('q1', false)).rejects.toEqual({ message: 'forbidden' })
  })
})
