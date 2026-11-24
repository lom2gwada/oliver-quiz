import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('./supabase', () => ({ supabase: { rpc } }))

import { QuizAdminError } from './quizAdmins'
import { fetchQuizAuditLog } from './quizAudit'

beforeEach(() => rpc.mockReset())

describe('fetchQuizAuditLog', () => {
  it('reads the journal of one quiz', async () => {
    const rows = [{ id: '1', action: 'create_quiz' }]
    rpc.mockResolvedValue({ data: rows, error: null })
    expect(await fetchQuizAuditLog('q1')).toBe(rows)
    expect(rpc).toHaveBeenCalledWith('quiz_audit_log', { p_quiz_id: 'q1', p_limit: 100 })
  })

  it('reads the journal of every quiz (global administrator) with no quiz', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await fetchQuizAuditLog(null, 50)
    expect(rpc).toHaveBeenCalledWith('quiz_audit_log', { p_quiz_id: null, p_limit: 50 })
  })

  it('copes with an empty answer', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await fetchQuizAuditLog('q1')).toEqual([])
  })

  it('explains a refusal', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } })
    const failure = await fetchQuizAuditLog('q1').catch((error) => error)
    expect(failure).toBeInstanceOf(QuizAdminError)
    expect(failure.failure).toBe('forbidden')
  })
})
