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
vi.mock('../utils/download', () => ({ downloadTextFile: vi.fn() }))
vi.mock('../utils/hostedQuizzes', () => ({ fetchAccessibleQuizzes: vi.fn() }))
vi.mock('./InviteUserForm', () => ({ InviteUserForm: () => null }))
vi.mock('../utils/adminUsers', async (importOriginal) => ({ ...(await importOriginal<typeof import('../utils/adminUsers')>()), fetchAdminUsers: vi.fn() }))
vi.mock('../utils/adminUserActions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/adminUserActions')>()),
  setUserDisabled: vi.fn(), setUserQuizAccess: vi.fn(),
}))

import { confirmDialog } from '../utils/confirmDialog'
import { downloadTextFile } from '../utils/download'
import { fetchAccessibleQuizzes } from '../utils/hostedQuizzes'
import { fetchAdminUsers } from '../utils/adminUsers'
import * as actions from '../utils/adminUserActions'
import { UsersPage } from './UsersPage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>
const DAY = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString()
const user = (pseudo: string, overrides: Partial<AdminUser> = {}): AdminUser => ({
  user_id: `id-${pseudo}`, pseudo, avatar: '🙂', email: `${pseudo.toLowerCase()}@example.com`, is_admin: false, is_self: false,
  created_at: daysAgo(300), last_sign_in_at: daysAgo(2), disabled: false, games_played: 3, last_played_at: daysAgo(2),
  ...overrides,
})
const everyone = [
  user('Moi', { is_self: true, is_admin: true }),
  user('Alice'),
  user('Bob', { last_sign_in_at: daysAgo(150), last_played_at: null }),
  user('Carl', { last_sign_in_at: daysAgo(400), last_played_at: daysAgo(380) }),
  user('Dana', { last_sign_in_at: null, last_played_at: null, games_played: 0 }),
]

let container: HTMLDivElement
let root: Root
const onOpenUser = vi.fn()

async function mount() {
  await act(async () => { root.render(createElement(UsersPage, { onBack: () => {}, onOpenUser })) })
  await act(async () => { await Promise.resolve() })
}
const setValue = async (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  const proto = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  })
}
const search = (value: string) => setValue(container.querySelector('input[type=search]') as HTMLInputElement, value)
const filterSelect = () => container.querySelectorAll('.users-controls select')[0] as HTMLSelectElement
const names = () => [...container.querySelectorAll('.overview-item-title')].map((element) => element.firstChild?.textContent ?? '')
const checkbox = (pseudo: string) => container.querySelector(`input[aria-label="Sélectionner ${pseudo}"]`) as HTMLInputElement
const selectAll = () => [...container.querySelectorAll('.users-list-tools input')][0] as HTMLInputElement
const buttonByText = (text: string) => [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === text) as HTMLButtonElement | undefined
const click = async (element: Element | undefined) => { expect(element, 'element to click').toBeDefined(); await act(async () => { (element as HTMLElement).click() }) }
const bar = () => container.querySelector('.users-bulk')

beforeEach(() => {
  vi.clearAllMocks()
  mocked(fetchAdminUsers).mockResolvedValue(everyone)
  mocked(fetchAccessibleQuizzes).mockResolvedValue([{ id: 'q1', title: 'Java', is_public: false }])
  mocked(actions.setUserDisabled).mockResolvedValue(undefined)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe('UsersPage — inactivity filter', () => {
  it('offers « inactifs depuis… » and shows the number of days only when it is chosen', async () => {
    await mount()
    expect([...filterSelect().options].map((option) => option.textContent)).toContain('Inactifs depuis…')
    expect(container.querySelectorAll('.users-controls select')).toHaveLength(2)
    await setValue(filterSelect(), 'inactive')
    expect(container.querySelectorAll('.users-controls select')).toHaveLength(3)
    const days = container.querySelectorAll('.users-controls select')[1] as HTMLSelectElement
    expect([...days.options].map((option) => option.textContent)).toEqual(['30 jours', '60 jours', '90 jours', '180 jours', '365 jours'])
    expect(days.value).toBe('90')
  })

  it('keeps the accounts inactive for more than 90 days by default, and never the ones that never signed in', async () => {
    await mount()
    await setValue(filterSelect(), 'inactive')
    expect(names()).toEqual(['Bob', 'Carl'])
  })

  it('follows the chosen duration', async () => {
    await mount()
    await setValue(filterSelect(), 'inactive')
    const days = container.querySelectorAll('.users-controls select')[1] as HTMLSelectElement
    await setValue(days, '365')
    expect(names()).toEqual(['Carl'])
    await setValue(days, '30')
    expect(names()).toEqual(['Bob', 'Carl'])
  })

  it('still offers « jamais connectés » separately', async () => {
    await mount()
    await setValue(filterSelect(), 'never')
    expect(names()).toEqual(['Dana'])
  })
})

describe('UsersPage — selection', () => {
  it('has a checkbox per user, unchecked at first, and no action bar', async () => {
    await mount()
    for (const pseudo of ['Moi', 'Alice', 'Bob', 'Carl', 'Dana']) expect(checkbox(pseudo).checked).toBe(false)
    expect(bar()).toBeNull()
  })

  it('shows the action bar with the count as soon as someone is ticked', async () => {
    await mount()
    await click(checkbox('Alice'))
    expect(bar()?.textContent).toContain('1 sélectionné')
    await click(checkbox('Bob'))
    expect(bar()?.textContent).toContain('2 sélectionnés')
    await click(checkbox('Alice'))
    expect(bar()?.textContent).toContain('1 sélectionné')
  })

  it('selects and unselects everybody shown', async () => {
    await mount()
    expect(selectAll().parentElement?.textContent).toContain('Tout sélectionner (5)')
    await click(selectAll())
    expect(bar()?.textContent).toContain('5 sélectionnés')
    expect(selectAll().checked).toBe(true)
    await click(selectAll())
    expect(bar()).toBeNull()
  })

  it('« select all » only concerns what the filters leave on screen', async () => {
    await mount()
    await setValue(filterSelect(), 'inactive')
    expect(selectAll().parentElement?.textContent).toContain('Tout sélectionner (2)')
    await click(selectAll())
    expect(bar()?.textContent).toContain('2 sélectionnés')
    await setValue(filterSelect(), 'all')
    expect(bar()?.textContent).toContain('2 sélectionnés')
    expect(checkbox('Alice').checked).toBe(false)
    expect(checkbox('Bob').checked).toBe(true)
  })

  it('never acts on a selection that the filters hide', async () => {
    await mount()
    await click(checkbox('Alice'))
    await search('bob')
    expect(names()).toEqual(['Bob'])
    expect(bar()).toBeNull()
    await search('')
    expect(bar()?.textContent).toContain('1 sélectionné')
    expect(checkbox('Alice').checked).toBe(true)
  })

  it('clears the whole selection on request', async () => {
    await mount()
    await click(selectAll())
    await click(buttonByText('Tout désélectionner'))
    expect(bar()).toBeNull()
    expect(checkbox('Alice').checked).toBe(false)
  })

  it('opens the profile when the card is pressed, without touching the selection', async () => {
    await mount()
    // La liste est triée par pseudo : Alice est la première carte (Moi, l'administrateur, la dernière).
    await click(container.querySelectorAll('.overview-item')[0])
    expect(onOpenUser).toHaveBeenCalledWith('id-Alice')
    expect(bar()).toBeNull()
  })
})

describe('UsersPage — bulk action', () => {
  it('disables the selected accounts, reloads the list and drops them from the selection', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(true)
    await mount()
    await click(checkbox('Alice'))
    await click(checkbox('Bob'))
    await click(buttonByText('Désactiver'))
    expect(mocked(actions.setUserDisabled).mock.calls).toEqual([['id-Alice', true], ['id-Bob', true]])
    expect(fetchAdminUsers).toHaveBeenCalledTimes(2)
    expect(checkbox('Alice').checked).toBe(false)
    expect(checkbox('Bob').checked).toBe(false)
    expect(bar()?.textContent).toContain('2 comptes désactivés.')
  })

  it('keeps ticked the accounts the action was refused for, so they can be seen and retried', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(true)
    mocked(actions.setUserDisabled).mockImplementation(async (userId: string) => { if (userId === 'id-Bob') throw new actions.UserActionError('lastAdmin') })
    await mount()
    await click(checkbox('Alice'))
    await click(checkbox('Bob'))
    await click(buttonByText('Désactiver'))
    expect(checkbox('Alice').checked).toBe(false)
    expect(checkbox('Bob').checked).toBe(true)
    expect(bar()?.textContent).toContain('Bob — Il doit rester au moins un administrateur actif.')
  })
})

describe('UsersPage — CSV export', () => {
  it('warns that the file holds personal data, and downloads nothing if declined', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(false)
    await mount()
    await click(buttonByText('⬇️ Exporter (CSV)'))
    const options = vi.mocked(confirmDialog).mock.calls[0][0]
    expect(options.title).toBe('Exporter la liste ?')
    expect(options.message).toContain('adresses email')
    expect(options.message).toContain('5 utilisateurs')
    expect(options.message).toContain('données personnelles')
    expect(downloadTextFile).not.toHaveBeenCalled()
  })

  it('downloads the whole list, with the filename of the day, once confirmed', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(true)
    await mount()
    await click(buttonByText('⬇️ Exporter (CSV)'))
    expect(downloadTextFile).toHaveBeenCalledTimes(1)
    const [filename, content, mime] = vi.mocked(downloadTextFile).mock.calls[0]
    const today = new Date()
    expect(filename).toBe(`utilisateurs-oliver-quiz-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.csv`)
    expect(mime).toBe('text/csv')
    expect(content.charCodeAt(0)).toBe(0xfeff)
    const lines = content.slice(1).split('\r\n').filter(Boolean)
    expect(lines).toHaveLength(6)
    expect(lines[0]).toBe('Pseudo;Email;Rôle;Statut;Inscrit le;Dernière connexion;Parties;Dernière partie')
    expect(lines.slice(1).map((line) => line.split(';')[0])).toEqual(['Alice', 'Bob', 'Carl', 'Dana', 'Moi'])
  })

  it('exports only what the filters leave on screen, in the order shown', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(true)
    await mount()
    await setValue(filterSelect(), 'inactive')
    await click(buttonByText('⬇️ Exporter (CSV)'))
    expect(vi.mocked(confirmDialog).mock.calls[0][0].message).toContain('2 utilisateurs')
    const content = vi.mocked(downloadTextFile).mock.calls[0][1]
    const lines = content.slice(1).split('\r\n').filter(Boolean)
    expect(lines.slice(1).map((line) => line.split(';')[0])).toEqual(['Bob', 'Carl'])
  })

  it('exports a search the same way', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(true)
    await mount()
    await search('ali')
    await click(buttonByText('⬇️ Exporter (CSV)'))
    const lines = vi.mocked(downloadTextFile).mock.calls[0][1].slice(1).split('\r\n').filter(Boolean)
    expect(lines).toHaveLength(2)
    expect(lines[1].startsWith('Alice;alice@example.com;')).toBe(true)
  })

  it('has nothing to export when the filters leave nobody', async () => {
    await mount()
    await search('zzz')
    expect(buttonByText('⬇️ Exporter (CSV)')!.disabled).toBe(true)
  })
})
