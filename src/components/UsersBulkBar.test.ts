// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '../i18n/fr'
import type { AdminUser } from '../utils/adminUsers'

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: keyof typeof fr, ...args: unknown[]) => { const value = fr[key] as unknown; return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : value }, language: 'fr' }),
}))
vi.mock('../utils/supabase', () => ({ supabase: {} }))
vi.mock('../utils/confirmDialog', () => ({ confirmDialog: vi.fn() }))
vi.mock('../utils/hostedQuizzes', () => ({ fetchAccessibleQuizzes: vi.fn() }))
vi.mock('../utils/adminUserActions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/adminUserActions')>()),
  setUserDisabled: vi.fn(), setUserQuizAccess: vi.fn(),
}))

import { confirmDialog } from '../utils/confirmDialog'
import { fetchAccessibleQuizzes } from '../utils/hostedQuizzes'
import * as actions from '../utils/adminUserActions'
import { UsersBulkBar } from './UsersBulkBar'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>
const confirm = mocked(confirmDialog)
const user = (pseudo: string, overrides: Partial<AdminUser> = {}): AdminUser => ({
  user_id: `id-${pseudo}`, pseudo, avatar: '🙂', email: `${pseudo.toLowerCase()}@example.com`, is_admin: false, is_self: false,
  created_at: '2026-08-26T10:00:00Z', last_sign_in_at: '2026-10-26T10:00:00Z', disabled: false, games_played: 0, last_played_at: null,
  ...overrides,
})
const alice = user('Alice')
const bob = user('Bob')
const carl = user('Carl', { disabled: true })
const me = user('Moi', { is_self: true, is_admin: true })

let container: HTMLDivElement
let root: Root
const onDone = vi.fn(async () => {})
const onClear = vi.fn()

async function mount(selected: AdminUser[]) {
  await act(async () => { root.render(createElement(UsersBulkBar, { selected, onDone, onClear })) })
  await act(async () => { await Promise.resolve() })
}
const buttonByText = (text: string) => [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === text) as HTMLButtonElement | undefined
const click = async (element: Element | undefined) => { expect(element, 'element to click').toBeDefined(); await act(async () => { (element as HTMLElement).click() }) }
const quizSelect = () => container.querySelector('select') as HTMLSelectElement
async function chooseQuiz(id: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(quizSelect(), id)
    quizSelect().dispatchEvent(new Event('change', { bubbles: true }))
  })
}
const report = () => container.querySelector('.users-bulk-report')?.textContent ?? ''
const confirmedMessage = () => (confirm.mock.calls[0][0] as { message: string }).message

beforeEach(() => {
  vi.clearAllMocks()
  mocked(fetchAccessibleQuizzes).mockResolvedValue([
    { id: 'q-public', title: 'Culture générale', is_public: true },
    { id: 'q-java', title: 'Java — Niveau Expert', is_public: false },
    { id: 'q-spring', title: 'Spring', is_public: false },
  ])
  mocked(actions.setUserDisabled).mockResolvedValue(undefined)
  mocked(actions.setUserQuizAccess).mockResolvedValue(undefined)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe('UsersBulkBar — display', () => {
  it('shows nothing while nobody is selected', async () => {
    await mount([])
    expect(container.innerHTML).toBe('')
    expect(fetchAccessibleQuizzes).not.toHaveBeenCalled()
  })

  it('shows how many are selected and the four actions', async () => {
    await mount([alice, bob])
    expect(container.textContent).toContain('2 sélectionnés')
    for (const label of ['Désactiver', 'Réactiver', "Accorder l'accès", "Retirer l'accès", 'Tout désélectionner']) expect(buttonByText(label), label).toBeDefined()
  })

  it('reads the quizzes once, at the first selection, and offers only the private ones', async () => {
    await mount([alice])
    await mount([alice, bob])
    expect(fetchAccessibleQuizzes).toHaveBeenCalledTimes(1)
    const options = [...quizSelect().options].map((option) => option.textContent)
    expect(options).toEqual(['Choisir un quiz…', 'Java — Niveau Expert', 'Spring'])
  })

  it('keeps the access buttons disabled until a quiz is chosen', async () => {
    await mount([alice])
    expect(buttonByText("Accorder l'accès")!.disabled).toBe(true)
    expect(buttonByText("Retirer l'accès")!.disabled).toBe(true)
    await chooseQuiz('q-java')
    expect(buttonByText("Accorder l'accès")!.disabled).toBe(false)
  })

  it('says when the list of quizzes cannot be read', async () => {
    mocked(fetchAccessibleQuizzes).mockRejectedValue(new Error('network'))
    await mount([alice])
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Impossible de charger la liste des quiz.')
  })

  it('clears the selection on request', async () => {
    await mount([alice])
    await click(buttonByText('Tout désélectionner'))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

describe('UsersBulkBar — disable', () => {
  it('asks ONE recap confirmation naming the accounts and the other applications, and does nothing if declined', async () => {
    confirm.mockResolvedValue(false)
    await mount([alice, bob])
    await click(buttonByText('Désactiver'))
    expect(confirm).toHaveBeenCalledTimes(1)
    const options = confirm.mock.calls[0][0] as { title: string; message: string; destructive: boolean; confirmLabel: string }
    expect(options.title).toBe('Désactiver 2 comptes ?')
    expect(options.message).toContain('Alice, Bob')
    expect(options.message).toContain('Quiz Forge et Periodic Quiz')
    expect(options.message).toContain('journalisé à part')
    expect(options.destructive).toBe(true)
    expect(actions.setUserDisabled).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('disables each account on its own, in order, once confirmed', async () => {
    confirm.mockResolvedValue(true)
    await mount([alice, bob])
    await click(buttonByText('Désactiver'))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(mocked(actions.setUserDisabled).mock.calls).toEqual([['id-Alice', true], ['id-Bob', true]])
    expect(report()).toContain('2 comptes désactivés.')
    expect(onDone).toHaveBeenCalledWith(['id-Alice', 'id-Bob'])
  })

  it('leaves out the administrator’s own account and the accounts already disabled, and says so in the confirmation', async () => {
    confirm.mockResolvedValue(true)
    await mount([me, alice, carl])
    await click(buttonByText('Désactiver'))
    expect(confirmedMessage()).toContain('Votre propre compte est ignoré.')
    expect(confirmedMessage()).toContain('1 compte déjà dans cet état : ignoré.')
    expect(confirmedMessage()).not.toContain('Moi')
    expect(confirmedMessage()).not.toContain('Carl')
    expect(mocked(actions.setUserDisabled).mock.calls).toEqual([['id-Alice', true]])
  })

  it('does not even ask when there is nothing to do', async () => {
    await mount([me, carl])
    await click(buttonByText('Désactiver'))
    expect(confirm).not.toHaveBeenCalled()
    expect(actions.setUserDisabled).not.toHaveBeenCalled()
    expect(report()).toContain('Rien à faire pour cette sélection.')
  })

  it('names the first accounts and counts the others when there are many', async () => {
    confirm.mockResolvedValue(false)
    const many = Array.from({ length: 9 }, (_, index) => user(`U${index}`))
    await mount(many)
    await click(buttonByText('Désactiver'))
    expect(confirmedMessage()).toContain('U0, U1, U2, U3, U4, U5 et 3 autres')
    expect(confirmedMessage()).not.toContain('U8')
  })

  it('goes on after a refusal, reports each reason, and only reports the done ones as done', async () => {
    confirm.mockResolvedValue(true)
    mocked(actions.setUserDisabled).mockImplementation(async (userId: string) => {
      if (userId === 'id-Alice') throw new actions.UserActionError('lastAdmin')
      if (userId === 'id-Bob') throw new Error('network')
    })
    await mount([alice, bob, user('Dana')])
    await click(buttonByText('Désactiver'))
    expect(mocked(actions.setUserDisabled).mock.calls.map(([id]) => id)).toEqual(['id-Alice', 'id-Bob', 'id-Dana'])
    expect(report()).toContain('1 compte désactivé.')
    expect(report()).toContain('2 refus :')
    expect(report()).toContain('Alice — Il doit rester au moins un administrateur actif.')
    expect(report()).toContain("Bob — L'action a échoué. Réessayez.")
    expect(onDone).toHaveBeenCalledWith(['id-Dana'])
  })

  it('shows only the refusals when nothing succeeded', async () => {
    confirm.mockResolvedValue(true)
    mocked(actions.setUserDisabled).mockRejectedValue(new actions.UserActionError('forbidden'))
    await mount([alice])
    await click(buttonByText('Désactiver'))
    expect(report()).not.toContain('désactivé')
    expect(report()).toContain('1 refus :')
    expect(onDone).toHaveBeenCalledWith([])
  })

  it('keeps the report on screen once the selection is empty', async () => {
    confirm.mockResolvedValue(true)
    await mount([alice])
    await click(buttonByText('Désactiver'))
    await mount([])
    expect(report()).toContain('1 compte désactivé.')
    expect(container.textContent).not.toContain('sélectionné')
  })
})

describe('UsersBulkBar — enable', () => {
  it('re-enables only the disabled accounts, after one confirmation that is not destructive', async () => {
    confirm.mockResolvedValue(true)
    await mount([alice, carl])
    await click(buttonByText('Réactiver'))
    const options = confirm.mock.calls[0][0] as { title: string; destructive?: boolean }
    expect(options.title).toBe('Réactiver 1 compte ?')
    expect(options.destructive).toBeFalsy()
    expect(mocked(actions.setUserDisabled).mock.calls).toEqual([['id-Carl', false]])
    expect(report()).toContain('1 compte réactivé.')
  })
})

describe('UsersBulkBar — quiz access', () => {
  it('grants the chosen quiz to everybody selected, with one confirmation naming the quiz', async () => {
    confirm.mockResolvedValue(true)
    await mount([me, alice, bob])
    await chooseQuiz('q-java')
    await click(buttonByText("Accorder l'accès"))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirmedMessage()).toContain('« Java — Niveau Expert »')
    expect(confirmedMessage()).toContain('Moi, Alice, Bob')
    expect(mocked(actions.setUserQuizAccess).mock.calls).toEqual([['id-Moi', 'q-java', true], ['id-Alice', 'q-java', true], ['id-Bob', 'q-java', true]])
    expect(report()).toContain('Accès au quiz « Java — Niveau Expert » accordé à 3 utilisateurs.')
  })

  it('revokes it the same way', async () => {
    confirm.mockResolvedValue(true)
    await mount([alice])
    await chooseQuiz('q-spring')
    await click(buttonByText("Retirer l'accès"))
    expect(mocked(actions.setUserQuizAccess).mock.calls).toEqual([['id-Alice', 'q-spring', false]])
    expect(report()).toContain('Accès au quiz « Spring » retiré à 1 utilisateur.')
  })

  it('does nothing when the confirmation is declined', async () => {
    confirm.mockResolvedValue(false)
    await mount([alice])
    await chooseQuiz('q-java')
    await click(buttonByText("Accorder l'accès"))
    expect(actions.setUserQuizAccess).not.toHaveBeenCalled()
  })

  it('reports a refusal and keeps the other grants', async () => {
    confirm.mockResolvedValue(true)
    mocked(actions.setUserQuizAccess).mockImplementation(async (userId: string) => { if (userId === 'id-Bob') throw new actions.UserActionError('notFound') })
    await mount([alice, bob])
    await chooseQuiz('q-java')
    await click(buttonByText("Accorder l'accès"))
    expect(report()).toContain('accordé à 1 utilisateur.')
    expect(report()).toContain("Bob — Cet utilisateur n'existe plus.")
  })
})
