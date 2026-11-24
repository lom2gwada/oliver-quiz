// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '../i18n/fr'
import type { QuizAdmin } from '../utils/quizAdmins'

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: keyof typeof fr, ...args: unknown[]) => { const value = fr[key] as unknown; return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : value }, language: 'fr' }),
}))
vi.mock('../utils/supabase', () => ({ supabase: {} }))
vi.mock('../utils/confirmDialog', () => ({ confirmDialog: vi.fn() }))
vi.mock('../utils/quizAdmins', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/quizAdmins')>()),
  listQuizAdmins: vi.fn(), setQuizAdminRole: vi.fn(), removeQuizAdmin: vi.fn(), searchQuizUsers: vi.fn(),
}))

import { confirmDialog } from '../utils/confirmDialog'
import * as admins from '../utils/quizAdmins'
import { QuizAdminsPanel } from './QuizAdminsPanel'
import { SEARCH_DELAY_MS } from './QuizUserSearch'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>
const confirm = mocked(confirmDialog)
const list = mocked(admins.listQuizAdmins)
const setRole = mocked(admins.setQuizAdminRole)
const remove = mocked(admins.removeQuizAdmin)
const search = mocked(admins.searchQuizUsers)

const member = (pseudo: string, role: 'owner' | 'admin', overrides: Partial<QuizAdmin> = {}): QuizAdmin => ({
  user_id: `id-${pseudo}`, pseudo, avatar: '🙂', role, added_by_pseudo: 'Olivier', added_at: '2026-11-24T10:00:00Z', is_self: false, disabled: false, ...overrides,
})
const olivier = member('Olivier', 'owner', { is_self: true, added_by_pseudo: 'Olivier' })
const andree = member('Andrée', 'admin')

let container: HTMLDivElement
let root: Root
const onSelfChanged = vi.fn()

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
const mount = async (isOwner: boolean) => {
  await act(async () => { root.render(createElement(QuizAdminsPanel, { quizId: 'q1', quizTitle: 'Mon quiz', isOwner, onSelfChanged })) })
  await flush()
}
const buttons = () => [...container.querySelectorAll('button')]
const button = (label: string) => buttons().find((candidate) => candidate.textContent === label)
const press = async (label: string) => { const found = button(label); if (!found) throw new Error(`no button ${label}`); await act(async () => { found.click() }); await flush() }
const type = async (value: string) => {
  const input = container.querySelector('input[type="search"]') as HTMLInputElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => { vi.advanceTimersByTime(SEARCH_DELAY_MS + 10) })
  await flush()
}

beforeEach(() => {
  vi.useFakeTimers()
  confirm.mockReset(); list.mockReset(); setRole.mockReset(); remove.mockReset(); search.mockReset(); onSelfChanged.mockReset()
  confirm.mockResolvedValue(true)
  list.mockResolvedValue([olivier, andree])
  setRole.mockResolvedValue(undefined)
  remove.mockResolvedValue(undefined)
  search.mockResolvedValue([])
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers() })

describe('QuizAdminsPanel — the list', () => {
  it('lists the owners then the administrators, with their role, who added them and when', async () => {
    await mount(true)
    const rows = [...container.querySelectorAll('.quiz-admin-item')]
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('Olivier')
    expect(rows[0].textContent).toContain('(vous)')
    expect(rows[0].textContent).toContain('Propriétaire')
    expect(rows[1].textContent).toContain('Andrée')
    expect(rows[1].textContent).toContain('Administrateur')
    expect(rows[1].textContent).toContain('Ajouté par Olivier le')
    expect(list).toHaveBeenCalledWith('q1')
  })

  it('flags a disabled account and an administrator whose adder no longer exists', async () => {
    list.mockResolvedValue([olivier, member('Bob', 'admin', { disabled: true, added_by_pseudo: null })])
    await mount(true)
    const bob = container.querySelectorAll('.quiz-admin-item')[1]
    expect(bob.textContent).toContain('Compte désactivé')
    expect(bob.textContent).toContain('Ajouté le')
    expect(bob.textContent).not.toContain('Ajouté par')
  })

  it('says so when the list cannot be loaded, and offers to retry', async () => {
    list.mockRejectedValueOnce(new Error('boom'))
    await mount(true)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Impossible de charger la liste des administrateurs.')
    await press('Réessayer')
    expect(container.querySelectorAll('.quiz-admin-item')).toHaveLength(2)
  })
})

describe('QuizAdminsPanel — what each role sees', () => {
  it('lets an owner promote, demote, remove and add', async () => {
    await mount(true)
    expect(button('Nommer propriétaire')).toBeTruthy()
    expect(button('Rendre simple administrateur')).toBeTruthy()
    expect(buttons().filter((candidate) => candidate.textContent === 'Retirer')).toHaveLength(1)
    expect(button('Quitter ce quiz')).toBeTruthy()
    expect(container.textContent).toContain('Ajouter un administrateur')
    expect(container.querySelector('input[type="search"]')).not.toBeNull()
    expect(container.textContent).toContain('Le propriétaire peut tout faire sur ce quiz')
  })

  it('lets a plain administrator read the list and leave, nothing else', async () => {
    list.mockResolvedValue([member('Olivier', 'owner'), member('Andrée', 'admin', { is_self: true })])
    await mount(false)
    expect(button('Nommer propriétaire')).toBeUndefined()
    expect(button('Rendre simple administrateur')).toBeUndefined()
    expect(button('Retirer')).toBeUndefined()
    expect(button('Quitter ce quiz')).toBeTruthy()
    expect(container.querySelector('input[type="search"]')).toBeNull()
    expect(container.textContent).not.toContain('Ajouter un administrateur')
    expect(container.textContent).toContain('Vous administrez ce quiz sans en être propriétaire')
  })
})

describe('QuizAdminsPanel — adding an administrator', () => {
  const carl = { user_id: 'id-Carl', pseudo: 'Carl', avatar: '🧙', role: null, has_access: false }

  it('searches by pseudo, asks for confirmation, adds the account as administrator and reloads the list', async () => {
    search.mockResolvedValue([carl])
    await mount(true)
    await type('ca')
    expect(search).toHaveBeenCalledWith('q1', 'ca')
    list.mockResolvedValue([olivier, andree, member('Carl', 'admin')])
    await press('Ajouter')
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Carl') }))
    expect(confirm.mock.calls[0][0].message).toContain('Mon quiz')
    expect(setRole).toHaveBeenCalledWith('q1', 'id-Carl', 'admin')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Carl est maintenant administrateur de ce quiz.')
    expect(container.querySelectorAll('.quiz-admin-item')).toHaveLength(3)
  })

  it('does nothing when the confirmation is refused', async () => {
    search.mockResolvedValue([carl])
    confirm.mockResolvedValue(false)
    await mount(true)
    await type('ca')
    await press('Ajouter')
    expect(setRole).not.toHaveBeenCalled()
  })

  it('shows the role of an account that already administers the quiz instead of an add button', async () => {
    search.mockResolvedValue([{ ...carl, user_id: 'id-Andrée', pseudo: 'Andrée', role: 'admin' }])
    await mount(true)
    await type('An')
    const result = container.querySelector('.quiz-user-results li')!
    expect(result.textContent).toContain('Andrée')
    expect(result.textContent).toContain('Administrateur')
    expect(result.querySelector('button')).toBeNull()
  })

  it('explains a refusal: a disabled account cannot be added', async () => {
    search.mockResolvedValue([carl])
    setRole.mockRejectedValue(new admins.QuizAdminError('userDisabled'))
    await mount(true)
    await type('ca')
    await press('Ajouter')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Ce compte est désactivé : il ne peut pas devenir administrateur.')
  })

  it('tells the owner nobody was found', async () => {
    search.mockResolvedValue([])
    await mount(true)
    await type('zz')
    expect(container.textContent).toContain('Aucun compte trouvé.')
  })

  it('does not search for a single letter', async () => {
    await mount(true)
    await type('c')
    expect(search).not.toHaveBeenCalled()
  })
})

describe('QuizAdminsPanel — roles and removal', () => {
  it('promotes an administrator to owner after confirmation', async () => {
    await mount(true)
    await press('Nommer propriétaire')
    expect(confirm.mock.calls[0][0].message).toContain('Andrée')
    expect(setRole).toHaveBeenCalledWith('q1', 'id-Andrée', 'owner')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Andrée est maintenant propriétaire de ce quiz.')
    expect(onSelfChanged).not.toHaveBeenCalled()
  })

  it('removes an administrator after a destructive confirmation', async () => {
    await mount(true)
    const removeAndree = [...container.querySelectorAll('.quiz-admin-item')][1].querySelector('.quiz-admin-actions button:last-child') as HTMLButtonElement
    await act(async () => { removeAndree.click() })
    await flush()
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true }))
    expect(remove).toHaveBeenCalledWith('q1', 'id-Andrée')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Andrée n\'administre plus ce quiz.')
  })

  it('explains the last-owner guard and reloads the list', async () => {
    remove.mockRejectedValue(new admins.QuizAdminError('lastOwner'))
    list.mockResolvedValue([olivier])
    await mount(true)
    await press('Quitter ce quiz')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Un quiz doit garder au moins un propriétaire')
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('tells the page when the signed-in account leaves, and does not reload a list it can no longer read', async () => {
    list.mockResolvedValue([member('Olivier', 'owner'), member('Andrée', 'admin', { is_self: true })])
    await mount(false)
    await press('Quitter ce quiz')
    expect(confirm.mock.calls[0][0].message).toContain('Quitter l\'administration du quiz « Mon quiz »')
    expect(remove).toHaveBeenCalledWith('q1', 'id-Andrée')
    expect(onSelfChanged).toHaveBeenCalledWith(true)
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('tells the page when an owner demotes themself (they keep administering)', async () => {
    list.mockResolvedValue([olivier, member('Andrée', 'owner')])
    await mount(true)
    const demoteSelf = [...container.querySelectorAll('.quiz-admin-item')][0].querySelector('.quiz-admin-actions button') as HTMLButtonElement
    expect(demoteSelf.textContent).toBe('Rendre simple administrateur')
    await act(async () => { demoteSelf.click() })
    await flush()
    expect(setRole).toHaveBeenCalledWith('q1', 'id-Olivier', 'admin')
    expect(onSelfChanged).toHaveBeenCalledWith(false)
  })
})
