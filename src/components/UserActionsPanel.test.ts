// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '../i18n/fr'
import type { AdminUserDetail, AdminUserQuiz } from '../utils/adminUsers'
import type { AuditEntry } from '../utils/adminUserActions'

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: keyof typeof fr, ...args: unknown[]) => { const value = fr[key] as unknown; return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : value }, language: 'fr' }),
}))
vi.mock('@engine/utils/sound', () => ({ playClick: vi.fn() }))
vi.mock('../utils/supabase', () => ({ supabase: {} }))
vi.mock('../utils/confirmDialog', () => ({ confirmDialog: vi.fn() }))
vi.mock('../utils/adminUserActions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/adminUserActions')>()),
  setUserDisabled: vi.fn(), setUserAdmin: vi.fn(), updateUserProfile: vi.fn(), setUserQuizAccess: vi.fn(), resetUserProgress: vi.fn(), deleteUser: vi.fn(), fetchUserAuditLog: vi.fn(),
}))

import { confirmDialog } from '../utils/confirmDialog'
import * as actions from '../utils/adminUserActions'
import { UserActionsPanel } from './UserActionsPanel'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocked = <T extends (...args: never[]) => unknown>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>
const confirm = mocked(confirmDialog)

const quiz = (id: string, overrides: Partial<AdminUserQuiz> = {}): AdminUserQuiz => ({
  quiz_id: id, quiz_title: `Quiz ${id}`, question_count: 10, seen_count: 0, games_played: 0, last_played_at: null, has_access: false, is_public: false, ...overrides,
})
const detail = (overrides: Partial<AdminUserDetail> = {}): AdminUserDetail => ({
  user_id: 'u-alice', pseudo: 'Alice', avatar: '🦊', email: 'alice@example.com', is_admin: false, is_self: false,
  created_at: '2026-08-26T12:00:00Z', last_sign_in_at: '2026-10-26T12:00:00Z', disabled: false, games_played: 3, last_played_at: null,
  games: { classic: 3, streak: 0, timed: 0 },
  quizzes: [quiz('public', { is_public: true }), quiz('granted', { has_access: true }), quiz('closed')],
  ...overrides,
})

let container: HTMLDivElement
let root: Root
const onChanged = vi.fn(async () => {})
const onDeleted = vi.fn()

async function mount(user: AdminUserDetail = detail()) {
  await act(async () => { root.render(createElement(UserActionsPanel, { detail: user, onChanged, onDeleted })) })
}
const flush = () => act(async () => { await Promise.resolve() })
const buttonByText = (text: string) => [...container.querySelectorAll('button')].find((button) => button.textContent?.includes(text)) as HTMLButtonElement | undefined
const click = async (element: Element | undefined) => { expect(element, 'element to click').toBeDefined(); await act(async () => { (element as HTMLElement).click() }) }
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const radio = (value: string) => ([...container.querySelectorAll('input[type=radio]')] as HTMLInputElement[]).find((input) => input.value === value)
const alertText = () => container.querySelector('[role=alert]')?.textContent ?? ''
const noticeText = () => container.querySelector('[role=status].profile-saved, .profile-saved')?.textContent ?? ''

beforeEach(() => {
  vi.clearAllMocks()
  mocked(actions.fetchUserAuditLog).mockResolvedValue([])
  for (const name of ['setUserDisabled', 'setUserAdmin', 'updateUserProfile', 'setUserQuizAccess', 'deleteUser'] as const) mocked(actions[name]).mockResolvedValue(null)
  mocked(actions.resetUserProgress).mockResolvedValue({ quiz_results: 3, question_results: 20, streak_results: 0, timed_results: 0, question_progress: 5 })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe('UserActionsPanel — disable and re-enable', () => {
  it('asks for confirmation and does nothing when it is declined', async () => {
    confirm.mockResolvedValue(false)
    await mount()
    await click(buttonByText('Désactiver le compte'))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(actions.setUserDisabled).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('warns that the account is shared by the other applications', async () => {
    confirm.mockResolvedValue(false)
    await mount()
    await click(buttonByText('Désactiver le compte'))
    const { message, destructive } = confirm.mock.calls[0][0] as { message: string; destructive: boolean }
    expect(message).toContain('Alice')
    expect(message).toContain('Quiz Forge et Periodic Quiz')
    expect(destructive).toBe(true)
  })

  it('disables the account once confirmed, then reloads the page and says so', async () => {
    confirm.mockResolvedValue(true)
    await mount()
    await click(buttonByText('Désactiver le compte'))
    expect(actions.setUserDisabled).toHaveBeenCalledWith('u-alice', true)
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(noticeText()).toBe('Compte désactivé.')
  })

  it('re-enables a disabled account without asking', async () => {
    await mount(detail({ disabled: true }))
    expect(buttonByText('Désactiver le compte')).toBeUndefined()
    await click(buttonByText('Réactiver le compte'))
    expect(confirm).not.toHaveBeenCalled()
    expect(actions.setUserDisabled).toHaveBeenCalledWith('u-alice', false)
    expect(noticeText()).toBe('Compte réactivé.')
  })

  it('shows the refusal of the database and does not reload on failure', async () => {
    confirm.mockResolvedValue(true)
    mocked(actions.setUserDisabled).mockRejectedValue(new actions.UserActionError('lastAdmin'))
    await mount()
    await click(buttonByText('Désactiver le compte'))
    expect(alertText()).toBe('Il doit rester au moins un administrateur actif.')
    expect(onChanged).not.toHaveBeenCalled()
    expect(noticeText()).toBe('')
  })

  it('shows a generic message for an unexpected failure', async () => {
    confirm.mockResolvedValue(true)
    mocked(actions.setUserDisabled).mockRejectedValue(new Error('network'))
    await mount()
    await click(buttonByText('Désactiver le compte'))
    expect(alertText()).toBe("L'action a échoué. Réessayez.")
  })

  it('does not call the action a failed reload invalidates', async () => {
    confirm.mockResolvedValue(true)
    onChanged.mockRejectedValueOnce(new Error('reload failed'))
    await mount()
    await click(buttonByText('Désactiver le compte'))
    expect(actions.setUserDisabled).toHaveBeenCalledTimes(1)
    expect(alertText()).toBe('')
    expect(noticeText()).toBe('Compte désactivé.')
  })
})

describe('UserActionsPanel — role', () => {
  it('makes a player an administrator once confirmed', async () => {
    confirm.mockResolvedValue(true)
    await mount()
    await click(buttonByText('Nommer administrateur'))
    expect(actions.setUserAdmin).toHaveBeenCalledWith('u-alice', true)
    expect(noticeText()).toBe('Administrateur nommé.')
  })

  it('removes the status of an administrator, and declining does nothing', async () => {
    await mount(detail({ is_admin: true }))
    confirm.mockResolvedValueOnce(false)
    await click(buttonByText("Retirer le statut d'administrateur"))
    expect(actions.setUserAdmin).not.toHaveBeenCalled()
    confirm.mockResolvedValueOnce(true)
    await click(buttonByText("Retirer le statut d'administrateur"))
    expect(actions.setUserAdmin).toHaveBeenCalledWith('u-alice', false)
  })
})

describe('UserActionsPanel — own account', () => {
  it('hides what the safeguards would refuse: disable, role and delete', async () => {
    await mount(detail({ is_self: true, is_admin: true }))
    expect(container.textContent).toContain('vous ne pouvez ni le désactiver, ni le supprimer')
    expect(buttonByText('Désactiver le compte')).toBeUndefined()
    expect(buttonByText('Réactiver le compte')).toBeUndefined()
    expect(buttonByText("Retirer le statut d'administrateur")).toBeUndefined()
    expect(buttonByText('Supprimer définitivement')).toBeUndefined()
    expect(buttonByText('Réinitialiser sa progression')).toBeDefined()
  })
})

describe('UserActionsPanel — profile', () => {
  it('saves a new pseudo and avatar, and keeps Save disabled until something changed', async () => {
    await mount()
    const save = buttonByText('Enregistrer')!
    expect(save.disabled).toBe(true)
    await type(container.querySelector('.users-edit-form input:not([type=radio])') as HTMLInputElement, '  Alice 2  ')
    expect(save.disabled).toBe(false)
    await act(async () => { radio('🚀')!.click() })
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(actions.updateUserProfile).toHaveBeenCalledWith('u-alice', '  Alice 2  ', '🚀')
    expect(noticeText()).toBe('Profil enregistré ✓')
  })

  it('shows an invalid pseudo refused by the database', async () => {
    mocked(actions.updateUserProfile).mockRejectedValue(new actions.UserActionError('invalidPseudo'))
    await mount()
    await type(container.querySelector('.users-edit-form input:not([type=radio])') as HTMLInputElement, 'x')
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    expect(alertText()).toBe('Le pseudo doit faire entre 1 et 30 caractères.')
  })

  it('keeps an avatar that is not in the usual list', async () => {
    await mount(detail({ avatar: '🦄' }))
    expect(radio('🦄')).toBeDefined()
    expect(radio('🦄')!.checked).toBe(true)
  })
})

describe('UserActionsPanel — quiz access', () => {
  it('lists every quiz; a public one is ticked and locked', async () => {
    await mount()
    const boxes = [...container.querySelectorAll('.users-access input[type=checkbox]')] as HTMLInputElement[]
    expect(boxes).toHaveLength(3)
    expect([boxes[0].checked, boxes[0].disabled]).toEqual([true, true])
    expect([boxes[1].checked, boxes[1].disabled]).toEqual([true, false])
    expect([boxes[2].checked, boxes[2].disabled]).toEqual([false, false])
    expect(container.textContent).toContain('Public — accessible à tous')
  })

  it('grants and revokes access to a quiz', async () => {
    await mount()
    const boxes = [...container.querySelectorAll('.users-access input[type=checkbox]')] as HTMLInputElement[]
    await click(boxes[2])
    expect(actions.setUserQuizAccess).toHaveBeenLastCalledWith('u-alice', 'closed', true)
    await click(boxes[1])
    expect(actions.setUserQuizAccess).toHaveBeenLastCalledWith('u-alice', 'granted', false)
  })
})

describe('UserActionsPanel — danger zone', () => {
  const deleteButton = () => buttonByText('Supprimer définitivement')!
  const resetButton = () => buttonByText('Réinitialiser sa progression')!
  const confirmInputs = () => [...container.querySelectorAll('.danger-confirm input')] as HTMLInputElement[]

  it('keeps both red buttons disabled until the pseudo is retyped', async () => {
    await mount()
    expect(deleteButton().disabled).toBe(true)
    expect(resetButton().disabled).toBe(true)
    await type(confirmInputs()[1], 'alic')
    expect(deleteButton().disabled).toBe(true)
    await type(confirmInputs()[1], 'ALICE')
    expect(deleteButton().disabled).toBe(false)
    expect(resetButton().disabled).toBe(true)
  })

  it('says the account is shared with the other applications', async () => {
    await mount()
    expect(container.querySelector('.danger-zone')!.textContent).toContain('Quiz Forge et Periodic Quiz')
  })

  it('resets the progress and reports what was erased', async () => {
    await mount()
    await type(confirmInputs()[0], 'Alice')
    await click(resetButton())
    expect(actions.resetUserProgress).toHaveBeenCalledWith('u-alice')
    expect(noticeText()).toBe('Progression réinitialisée : 3 parties et 20 réponses effacées.')
    expect(onChanged).toHaveBeenCalled()
    expect(resetButton().disabled).toBe(true)
  })

  it('says so when there was nothing to erase', async () => {
    mocked(actions.resetUserProgress).mockResolvedValue({ quiz_results: 0, question_results: 0, streak_results: 0, timed_results: 0, question_progress: 0 })
    await mount()
    await type(confirmInputs()[0], 'Alice')
    await click(resetButton())
    expect(noticeText()).toBe('Rien à effacer : aucune partie enregistrée.')
  })

  it('deletes the account once the pseudo is retyped, then leaves the page without reloading it', async () => {
    await mount()
    await type(confirmInputs()[1], 'Alice')
    await click(deleteButton())
    expect(actions.deleteUser).toHaveBeenCalledWith('u-alice')
    expect(onDeleted).toHaveBeenCalledTimes(1)
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('stays on the page and explains when the database refuses the deletion', async () => {
    mocked(actions.deleteUser).mockRejectedValue(new actions.UserActionError('lastAdmin'))
    await mount()
    await type(confirmInputs()[1], 'Alice')
    await click(deleteButton())
    expect(onDeleted).not.toHaveBeenCalled()
    expect(alertText()).toBe('Il doit rester au moins un administrateur actif.')
  })
})

describe('UserActionsPanel — audit log', () => {
  it('shows the latest actions in plain sentences', async () => {
    const entries: AuditEntry[] = [
      { id: '2', created_at: '2026-11-21T14:05:00Z', admin_pseudo: 'Olivier', target_pseudo: 'Alice', action: 'disable', details: {} },
      { id: '1', created_at: '2026-11-20T09:00:00Z', admin_pseudo: 'Olivier', target_pseudo: 'Alice', action: 'grant_access', details: { quiz_title: 'Culture générale' } },
    ]
    mocked(actions.fetchUserAuditLog).mockResolvedValue(entries)
    await mount()
    await flush()
    expect(actions.fetchUserAuditLog).toHaveBeenCalledWith('u-alice')
    const items = [...container.querySelectorAll('.users-audit li')].map((li) => li.textContent ?? '')
    expect(items).toHaveLength(2)
    expect(items[0]).toContain('Olivier a désactivé le compte')
    expect(items[1]).toContain("Olivier lui a accordé l'accès au quiz « Culture générale »")
  })

  it('says so when nothing was recorded, and when the log cannot be read', async () => {
    await mount()
    await flush()
    expect(container.textContent).toContain('Aucune action enregistrée.')
    mocked(actions.fetchUserAuditLog).mockRejectedValue(new Error('boom'))
    await mount(detail({ pseudo: 'Alice 2' }))
    await flush()
    expect(alertText()).toBe('Impossible de charger le journal.')
  })
})
