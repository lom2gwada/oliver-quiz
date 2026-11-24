import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('./supabase', () => ({ supabase: { rpc, auth: { signInWithPassword: vi.fn() } } }))

import { classifyDeleteError, deleteMyAccount } from './account'

describe('classifyDeleteError', () => {
  it('recognises the refusal made for the last administrator', () => {
    expect(classifyDeleteError('last_admin')).toBe('lastAdmin')
    expect(classifyDeleteError('P0001: last_admin')).toBe('lastAdmin')
  })

  it('recognises the refusal made for the only owner of a quiz', () => {
    expect(classifyDeleteError('sole_quiz_owner')).toBe('soleQuizOwner')
  })

  it('reports any other failure as a generic one', () => {
    expect(classifyDeleteError('permission denied for table users')).toBe('failed')
    expect(classifyDeleteError('')).toBe('failed')
    expect(classifyDeleteError(undefined)).toBe('failed')
  })
})

describe('deleteMyAccount', () => {
  beforeEach(() => rpc.mockReset())

  it('returns nothing once the account is deleted', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await deleteMyAccount()).toBeNull()
    expect(rpc).toHaveBeenCalledWith('delete_my_account')
  })

  it('lists the quizzes the account is the only owner of', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'sole_quiz_owner', details: 'Culture générale\nSpring' } })
    expect(await deleteMyAccount()).toEqual({ failure: 'soleQuizOwner', titles: ['Culture générale', 'Spring'] })
  })

  it('has no titles for another refusal', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'last_admin', details: 'Culture générale' } })
    expect(await deleteMyAccount()).toEqual({ failure: 'lastAdmin', titles: [] })
  })
})