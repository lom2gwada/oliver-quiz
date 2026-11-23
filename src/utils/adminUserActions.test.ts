import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '../i18n/fr'
import { en } from '../i18n/en'

const rpc = vi.hoisted(() => vi.fn())
const limit = vi.hoisted(() => vi.fn())
const order = vi.hoisted(() => vi.fn(() => ({ limit })))
const eq = vi.hoisted(() => vi.fn(() => ({ order })))
const select = vi.hoisted(() => vi.fn(() => ({ eq })))
const from = vi.hoisted(() => vi.fn(() => ({ select })))
const invoke = vi.hoisted(() => vi.fn())
vi.mock('./supabase', () => ({ supabase: { rpc, from, functions: { invoke } } }))

import {
  changeUserEmail, classifyAccountCode, classifyUserActionError, deleteUser, describeAuditEntry, exportUserData, fetchUserAuditLog, inviteUser, readFunctionError, resendInvite, resetUserProgress, sendPasswordReset, setUserAdmin, setUserDisabled, setUserQuizAccess, updateUserProfile, userDataFilename,
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
    expect(Object.keys(USER_ACTION_ERROR_KEYS).sort()).toEqual(['disabled', 'emailExists', 'failed', 'forbidden', 'invalidAvatar', 'invalidEmail', 'invalidPseudo', 'lastAdmin', 'noEmail', 'notActive', 'notFound', 'notPending', 'rateLimited', 'self', 'sendFailed', 'unavailable'])
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

/** Une réponse HTTP d'erreur de la fonction Edge, telle que la présente le client Supabase (`FunctionsHttpError.context`). */
const httpError = (status: number, payload: unknown, readable = true) => ({ context: { status, json: readable ? async () => payload : async () => { throw new Error('no body') } } })

describe('classifyAccountCode', () => {
  it.each([
    ['invalid_email', undefined, 'invalidEmail'],
    ['email_exists', 409, 'emailExists'],
    ['rate_limited', 429, 'rateLimited'],
    ['not_pending', 409, 'notPending'],
    ['not_active', 409, 'notActive'],
    ['disabled', 409, 'disabled'],
    ['no_email', 409, 'noEmail'],
    ['not_found', 404, 'notFound'],
    ['self_forbidden', 403, 'self'],
    ['forbidden', 403, 'forbidden'],
    ['unauthorized', 401, 'forbidden'],
    ['forbidden_origin', 403, 'forbidden'],
    ['send_failed', 502, 'sendFailed'],
    ['internal', 500, 'failed'],
    [undefined, 500, 'failed'],
    [undefined, 404, 'unavailable'],
  ] as [unknown, number | undefined, UserActionFailure][])('reads %s (status %s) as %s', (code, status, expected) => {
    expect(classifyAccountCode(code, status)).toBe(expected)
  })

  it('prefers the code of the function over the status: a 404 that carries our own code is not « unavailable »', () => {
    expect(classifyAccountCode('not_found', 404)).toBe('notFound')
  })
})

describe('readFunctionError', () => {
  it('reads the error code in the body of the response', async () => {
    expect(await readFunctionError(httpError(409, { error: 'email_exists' }))).toBe('emailExists')
  })

  it('says the function is unavailable when the server did not find it (404 without our code)', async () => {
    expect(await readFunctionError(httpError(404, { code: 'NOT_FOUND', message: 'Requested function was not found' }))).toBe('unavailable')
  })

  it('falls back on the status when the body cannot be read', async () => {
    expect(await readFunctionError(httpError(404, null, false))).toBe('unavailable')
    expect(await readFunctionError(httpError(500, null, false))).toBe('failed')
  })

  it('says it is unavailable when there was no response at all (network, relay)', async () => {
    expect(await readFunctionError(new Error('Failed to send a request to the Edge Function'))).toBe('unavailable')
    expect(await readFunctionError(null)).toBe('unavailable')
  })
})

describe('the account actions call the Edge function', () => {
  beforeEach(() => { invoke.mockReset(); invoke.mockResolvedValue({ data: { ok: true }, error: null }) })

  it('with the action and its arguments', async () => {
    await inviteUser('new@example.com')
    await resendInvite('u1')
    await sendPasswordReset('u1')
    await changeUserEmail('u1', 'new@example.com')
    expect(invoke.mock.calls).toEqual([
      ['admin-users', { body: { action: 'invite_user', email: 'new@example.com' } }],
      ['admin-users', { body: { action: 'resend_invite', userId: 'u1' } }],
      ['admin-users', { body: { action: 'send_password_reset', userId: 'u1' } }],
      ['admin-users', { body: { action: 'change_email', userId: 'u1', email: 'new@example.com' } }],
    ])
  })

  it('raise a UserActionError that says why the function refused', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(409, { error: 'email_exists' }) })
    const failure = await inviteUser('taken@example.com').catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(UserActionError)
    expect((failure as UserActionError).failure).toBe('emailExists')
  })

  it('are never retried by themselves: an email must not leave twice', async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(502, { error: 'send_failed' }) })
    await expect(inviteUser('a@b.fr')).rejects.toBeInstanceOf(UserActionError)
    expect(invoke).toHaveBeenCalledTimes(1)
  })
})

describe('exportUserData', () => {
  beforeEach(() => { rpc.mockReset() })

  it('asks the database for the export of one user and returns the document', async () => {
    rpc.mockResolvedValue({ data: { scope: 'oliver-quiz', quiz_results: [] }, error: null })
    expect(await exportUserData('u1')).toEqual({ scope: 'oliver-quiz', quiz_results: [] })
    expect(rpc).toHaveBeenCalledWith('admin_export_user_data', { p_user_id: 'u1' })
  })

  it('raises a UserActionError that says why the database refused', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'not_found' } })
    const failure = await exportUserData('u1').catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(UserActionError)
    expect((failure as UserActionError).failure).toBe('notFound')
  })

  it('treats an empty answer as a failure rather than downloading an empty file', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(exportUserData('u1')).rejects.toMatchObject({ failure: 'failed' })
  })

  it('is sent once: the export is logged, so it must not be replayed by itself', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } })
    await expect(exportUserData('u1')).rejects.toBeInstanceOf(UserActionError)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('userDataFilename', () => {
  const date = new Date(2026, 10, 24, 23, 30)

  it('carries the nickname without accents or awkward characters, and the date', () => {
    expect(userDataFilename('Andrée', date)).toBe('donnees-oliver-quiz-andree-2026-11-24.json')
    expect(userDataFilename('Jean-Luc  Picard!', date)).toBe('donnees-oliver-quiz-jean-luc-picard-2026-11-24.json')
  })

  it('never lets a nickname build a path or an empty name', () => {
    expect(userDataFilename('../../etc/passwd', date)).toBe('donnees-oliver-quiz-etc-passwd-2026-11-24.json')
    expect(userDataFilename('🦊🦊', date)).toBe('donnees-oliver-quiz-utilisateur-2026-11-24.json')
    expect(userDataFilename('', date)).toBe('donnees-oliver-quiz-utilisateur-2026-11-24.json')
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

  it('names the account actions of the Edge function', () => {
    expect(describeAuditEntry(entry('invite_user'), tFr)).toBe("Olivier a invité l'utilisateur")
    expect(describeAuditEntry(entry('resend_invite'), tFr)).toBe("Olivier a renvoyé l'invitation")
    expect(describeAuditEntry(entry('send_password_reset'), tFr)).toBe('Olivier a envoyé un lien de réinitialisation du mot de passe')
    expect(describeAuditEntry(entry('change_email'), tFr)).toBe("Olivier a changé l'adresse email du compte")
    expect(describeAuditEntry(entry('invite_user'), tEn)).toBe('Olivier invited the user')
    expect(describeAuditEntry(entry('change_email'), tEn)).toBe("Olivier changed the account's email address")
  })

  it('names the export of personal data', () => {
    expect(describeAuditEntry(entry('export_user_data'), tFr)).toBe('Olivier a exporté les données de la personne')
    expect(describeAuditEntry(entry('export_user_data'), tEn)).toBe("Olivier exported the person's data")
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
