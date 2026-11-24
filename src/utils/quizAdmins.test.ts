import { beforeEach, describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { fr } from '../i18n/fr'

const rpc = vi.hoisted(() => vi.fn())
const select = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn(() => ({ select })))
vi.mock('./supabase', () => ({ supabase: { rpc, from } }))

import {
  classifyQuizAdminError, fetchMyQuizRoles, fetchQuizAccessUsers, listQuizAdmins, QUIZ_ADMIN_ERROR_KEYS, QuizAdminError, removeQuizAdmin,
  searchQuizUsers, setQuizAdminRole, type QuizAdminFailure,
} from './quizAdmins'

beforeEach(() => { rpc.mockReset(); select.mockReset(); from.mockClear() })

describe('classifyQuizAdminError', () => {
  it.each([
    ['last_owner', 'lastOwner'],
    ['sole_quiz_owner', 'soleOwner'],
    ['user_disabled', 'userDisabled'],
    ['invalid_role', 'invalidRole'],
    ['conflict', 'conflict'],
    ['title_unavailable', 'titleUnavailable'],
    ['quiz_limit_reached', 'limitReached'],
    ['quiz_too_large', 'tooLarge'],
    ['not_found', 'notFound'],
    ['forbidden', 'forbidden'],
    ['new row violates row-level security policy for table "guest_links"', 'forbidden'],
    ['Failed to fetch', 'failed'],
    [undefined, 'failed'],
  ] as [string | undefined, QuizAdminFailure][])('reads %s as %s', (message, expected) => {
    expect(classifyQuizAdminError(message)).toBe(expected)
  })

  it('recognises the database codes even inside a longer message', () => {
    expect(classifyQuizAdminError('P0001: last_owner')).toBe('lastOwner')
  })
})

describe('QUIZ_ADMIN_ERROR_KEYS', () => {
  it('has a French and an English message for every failure', () => {
    for (const key of Object.values(QUIZ_ADMIN_ERROR_KEYS)) {
      expect(fr[key], `fr ${key}`).toEqual(expect.any(String))
      expect(en[key], `en ${key}`).toEqual(expect.any(String))
    }
  })

  it('covers every failure kind', () => {
    const kinds: QuizAdminFailure[] = ['forbidden', 'notFound', 'lastOwner', 'userDisabled', 'invalidRole', 'conflict', 'soleOwner', 'titleUnavailable', 'limitReached', 'tooLarge', 'failed']
    expect(Object.keys(QUIZ_ADMIN_ERROR_KEYS).sort()).toEqual([...kinds].sort())
  })
})

describe('fetchMyQuizRoles', () => {
  it('maps each own row to its role, by quiz', async () => {
    select.mockResolvedValue({ data: [{ quiz_id: 'q1', role: 'owner' }, { quiz_id: 'q2', role: 'admin' }], error: null })
    await expect(fetchMyQuizRoles()).resolves.toEqual({ q1: 'owner', q2: 'admin' })
    expect(from).toHaveBeenCalledWith('quiz_admins')
    expect(select).toHaveBeenCalledWith('quiz_id, role')
  })

  it('returns no role when the account administers nothing', async () => {
    select.mockResolvedValue({ data: [], error: null })
    await expect(fetchMyQuizRoles()).resolves.toEqual({})
    select.mockResolvedValue({ data: null, error: null })
    await expect(fetchMyQuizRoles()).resolves.toEqual({})
  })

  it('throws the database error', async () => {
    select.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(fetchMyQuizRoles()).rejects.toThrow('boom')
  })
})

describe('listQuizAdmins and fetchQuizAccessUsers', () => {
  it('asks the SQL functions for the quiz and returns the lists', async () => {
    const admins = [{ user_id: 'u1', pseudo: 'Alice', avatar: '🙂', role: 'owner', added_by_pseudo: 'Alice', added_at: '2026-11-24T10:00:00Z', is_self: true, disabled: false }]
    rpc.mockResolvedValueOnce({ data: admins, error: null })
    await expect(listQuizAdmins('q1')).resolves.toEqual(admins)
    expect(rpc).toHaveBeenCalledWith('quiz_admins_list', { p_quiz_id: 'q1' })
    rpc.mockResolvedValueOnce({ data: [{ user_id: 'u2', pseudo: 'Bob', avatar: '😎' }], error: null })
    await expect(fetchQuizAccessUsers('q1')).resolves.toEqual([{ user_id: 'u2', pseudo: 'Bob', avatar: '😎' }])
    expect(rpc).toHaveBeenLastCalledWith('quiz_access_users', { p_quiz_id: 'q1' })
  })

  it('treats a missing document as an empty list', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(listQuizAdmins('q1')).resolves.toEqual([])
  })

  it('turns a refusal into a QuizAdminError that says why', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } })
    const failure = await listQuizAdmins('q1').catch((error) => error)
    expect(failure).toBeInstanceOf(QuizAdminError)
    expect(failure.failure).toBe('forbidden')
  })
})

describe('searchQuizUsers', () => {
  it('searches by pseudo within the quiz', async () => {
    const found = [{ user_id: 'u3', pseudo: 'Carl', avatar: '🧙', role: null, has_access: false }]
    rpc.mockResolvedValue({ data: found, error: null })
    await expect(searchQuizUsers('q1', 'ca')).resolves.toEqual(found)
    expect(rpc).toHaveBeenCalledWith('quiz_search_users', { p_quiz_id: 'q1', p_query: 'ca' })
  })

  it('does not call the database for fewer than two characters', async () => {
    await expect(searchQuizUsers('q1', ' a ')).resolves.toEqual([])
    await expect(searchQuizUsers('q1', '')).resolves.toEqual([])
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('setQuizAdminRole and removeQuizAdmin', () => {
  it('names an administrator or an owner, or changes a role', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await setQuizAdminRole('q1', 'u1', 'admin')
    expect(rpc).toHaveBeenLastCalledWith('quiz_set_admin_role', { p_quiz_id: 'q1', p_user_id: 'u1', p_role: 'admin' })
    await setQuizAdminRole('q1', 'u1', 'owner')
    expect(rpc).toHaveBeenLastCalledWith('quiz_set_admin_role', { p_quiz_id: 'q1', p_user_id: 'u1', p_role: 'owner' })
  })

  it('removes an administrator', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await removeQuizAdmin('q1', 'u1')
    expect(rpc).toHaveBeenCalledWith('quiz_remove_admin', { p_quiz_id: 'q1', p_user_id: 'u1' })
  })

  it('reports the last-owner guard', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'last_owner' } })
    const failure = await removeQuizAdmin('q1', 'u1').catch((error) => error)
    expect(failure).toBeInstanceOf(QuizAdminError)
    expect(failure.failure).toBe('lastOwner')
  })

  it('reports a disabled account and an unknown role', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'user_disabled' } })
    expect((await setQuizAdminRole('q1', 'u1', 'admin').catch((error) => error)).failure).toBe('userDisabled')
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'invalid_role' } })
    expect((await setQuizAdminRole('q1', 'u1', 'admin').catch((error) => error)).failure).toBe('invalidRole')
  })
})
