import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '../i18n/fr'
import { en } from '../i18n/en'

const rpc = vi.hoisted(() => vi.fn())
const limit = vi.hoisted(() => vi.fn())
const order = vi.hoisted(() => vi.fn(() => ({ limit })))
const eq = vi.hoisted(() => vi.fn(() => ({ order })))
const select = vi.hoisted(() => vi.fn(() => ({ eq })))
const from = vi.hoisted(() => vi.fn(() => ({ select })))
vi.mock('./supabase', () => ({ supabase: { rpc, from } }))

import {
  classifyUserActionError, deleteUser, describeAuditEntry, fetchUserAuditLog, resetUserProgress, setUserAdmin, setUserDisabled, setUserQuizAccess, updateUserProfile,
  UserActionError, USER_ACTION_ERROR_KEYS, type AuditEntry, type UserActionFailure,
} from './adminUserActions'

const translate = (dictionary: Record<string, unknown>) => (key: string, ...args: unknown[]) => {
  const value = dictionary[key]
  return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : String(value)
}
const tFr = translate(fr as Record<string, unknown>) as Parameters<typeof describeAuditEntry>[1]
const tEn = translate(en as Record<string, unknown>) as Parameters<typeof describeAuditEntry>[1]

const entry = (action: AuditEntry['action'], details: Record<string, unknown> = {}): AuditEntry => ({
  id: 'e1', created_at: '2026-11-21T14:05:00Z', admin_pseudo: 'Olivier', target_pseudo: 'Alice', action, details,
})

describe('classifyUserActionError', () => {
  it.each([
    ['self_forbidden', 'self'],
    ['last_admin', 'lastAdmin'],
    ['invalid_pseudo', 'invalidPseudo'],
    ['invalid_avatar', 'invalidAvatar'],
    ['not_found', 'notFound'],
    ['forbidden', 'forbidden'],
    ['Failed to fetch', 'failed'],
    [undefined, 'failed'],
  ] as [string | undefined, UserActionFailure][])('reads %s as %s', (message, expected) => {
    expect(classifyUserActionError(message)).toBe(expected)
  })

  it('does not take the self refusal for a plain "forbidden"', () => {
    expect(classifyUserActionError('self_forbidden')).toBe('self')
  })
})

describe('USER_ACTION_ERROR_KEYS', () => {
  it('has a French and an English message for every failure', () => {
    for (const key of Object.values(USER_ACTION_ERROR_KEYS)) {
      expect(typeof (fr as Record<string, unknown>)[key]).toBe('string')
      expect(typeof (en as Record<string, unknown>)[key]).toBe('string')
    }
    expect(Object.keys(USER_ACTION_ERROR_KEYS).sort()).toEqual(['failed', 'forbidden', 'invalidAvatar', 'invalidPseudo', 'lastAdmin', 'notFound', 'self'])
  })
})

describe('the actions call the right database function', () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: null, error: null }) })

  it('with the arguments it expects', async () => {
    await setUserDisabled('u1', true)
    await updateUserProfile('u1', 'Alice', '🦊')
    await setUserAdmin('u1', false)
    await setUserQuizAccess('u1', 'q1', true)
    await deleteUser('u1')
    expect(rpc.mock.calls).toEqual([
      ['admin_set_user_disabled', { p_user_id: 'u1', p_disabled: true }],
      ['admin_update_user_profile', { p_user_id: 'u1', p_pseudo: 'Alice', p_avatar: '🦊' }],
      ['admin_set_user_admin', { p_user_id: 'u1', p_is_admin: false }],
      ['admin_set_user_quiz_access', { p_user_id: 'u1', p_quiz_id: 'q1', p_granted: true }],
      ['admin_delete_user', { p_user_id: 'u1' }],
    ])
  })

  it('returns what a reset erased', async () => {
    rpc.mockResolvedValue({ data: { quiz_results: 5, question_results: 50, streak_results: 0, timed_results: 0, question_progress: 0 }, error: null })
    expect(await resetUserProgress('u1')).toEqual({ quiz_results: 5, question_results: 50, streak_results: 0, timed_results: 0, question_progress: 0 })
    expect(rpc).toHaveBeenCalledWith('admin_reset_user_progress', { p_user_id: 'u1' })
  })

  it('raises a UserActionError that says why the database refused', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'last_admin' } })
    const failure = await setUserDisabled('u1', true).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(UserActionError)
    expect((failure as UserActionError).failure).toBe('lastAdmin')
  })

  it('does not retry by itself: a destructive action is sent once', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    await expect(deleteUser('u1')).rejects.toBeInstanceOf(UserActionError)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('fetchUserAuditLog', () => {
  beforeEach(() => { limit.mockReset(); from.mockClear(); select.mockClear(); eq.mockClear(); order.mockClear() })

  it('reads the latest entries of one user, newest first', async () => {
    limit.mockResolvedValue({ data: [entry('disable')], error: null })
    expect(await fetchUserAuditLog('u1', 5)).toEqual([entry('disable')])
    expect(from).toHaveBeenCalledWith('admin_audit_log')
    expect(eq).toHaveBeenCalledWith('target_id', 'u1')
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(limit).toHaveBeenCalledWith(5)
  })

  it('never asks for an email', async () => {
    limit.mockResolvedValue({ data: [], error: null })
    await fetchUserAuditLog('u1')
    expect(String(select.mock.calls[0])).not.toContain('email')
  })

  it('raises the error of the database', async () => {
    limit.mockResolvedValue({ data: null, error: { message: 'denied' } })
    await expect(fetchUserAuditLog('u1')).rejects.toEqual({ message: 'denied' })
  })
})

describe('describeAuditEntry', () => {
  it('names who did what', () => {
    expect(describeAuditEntry(entry('disable'), tFr)).toBe('Olivier a désactivé le compte')
    expect(describeAuditEntry(entry('enable'), tFr)).toBe('Olivier a réactivé le compte')
    expect(describeAuditEntry(entry('delete_user'), tFr)).toBe('Olivier a supprimé le compte')
  })

  it('tells a promotion from a demotion', () => {
    expect(describeAuditEntry(entry('set_admin', { is_admin: true }), tFr)).toBe("Olivier l'a nommé administrateur")
    expect(describeAuditEntry(entry('set_admin', { is_admin: false }), tFr)).toBe("Olivier lui a retiré le statut d'administrateur")
  })

  it('names the quiz of an access change', () => {
    expect(describeAuditEntry(entry('grant_access', { quiz_title: 'Java — Niveau Expert' }), tFr)).toBe("Olivier lui a accordé l'accès au quiz « Java — Niveau Expert »")
    expect(describeAuditEntry(entry('revoke_access', { quiz_title: 'Java — Niveau Expert' }), tFr)).toBe("Olivier lui a retiré l'accès au quiz « Java — Niveau Expert »")
  })

  it('counts the games and answers a reset erased', () => {
    const details = { quiz_results: 3, streak_results: 1, timed_results: 1, question_results: 50, question_progress: 20 }
    expect(describeAuditEntry(entry('reset_progress', details), tFr)).toBe('Olivier a réinitialisé sa progression (5 parties, 50 réponses)')
    expect(describeAuditEntry(entry('reset_progress', { quiz_results: 1, question_results: 1 }), tFr)).toBe('Olivier a réinitialisé sa progression (1 partie, 1 réponse)')
  })

  it('says what changed in a profile', () => {
    const both = { pseudo: { from: 'lom2gwada', to: 'Zoé' }, avatar: { from: '😎', to: '🦊' } }
    expect(describeAuditEntry(entry('update_profile', both), tFr)).toBe('Olivier a modifié le profil : pseudo « lom2gwada » → « Zoé », avatar 😎 → 🦊')
    expect(describeAuditEntry(entry('update_profile', { avatar: { from: '😎', to: '🦊' } }), tFr)).toBe('Olivier a modifié le profil : avatar 😎 → 🦊')
  })

  it('is also written in English', () => {
    expect(describeAuditEntry(entry('disable'), tEn)).toBe('Olivier disabled the account')
    expect(describeAuditEntry(entry('grant_access', { quiz_title: 'Spring' }), tEn)).toBe('Olivier granted them access to the quiz “Spring”')
    expect(describeAuditEntry(entry('reset_progress', { quiz_results: 1, question_results: 2 }), tEn)).toBe('Olivier reset their progress (1 game, 2 answers)')
  })

  it('does not fail on missing or unexpected details', () => {
    expect(describeAuditEntry(entry('update_profile', {}), tFr)).toBe('Olivier a modifié le profil : ')
    expect(describeAuditEntry(entry('grant_access', {}), tFr)).toBe("Olivier lui a accordé l'accès au quiz «  »")
    expect(describeAuditEntry(entry('reset_progress', { quiz_results: 'many' }), tFr)).toContain('0 partie')
    expect(describeAuditEntry({ ...entry('disable'), details: undefined as unknown as Record<string, unknown> }, tFr)).toBe('Olivier a désactivé le compte')
    expect(describeAuditEntry({ ...entry('disable'), admin_pseudo: '' }, tFr)).toBe('? a désactivé le compte')
    expect(describeAuditEntry({ ...entry('disable'), action: 'something_new' as AuditEntry['action'] }, tFr)).toBe('Olivier a effectué une action')
  })
})
