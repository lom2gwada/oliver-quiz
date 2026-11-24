// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '../i18n/fr'

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: keyof typeof fr, ...args: unknown[]) => { const value = fr[key] as unknown; return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : value }, language: 'fr' }),
}))
vi.mock('../utils/supabase', () => ({ supabase: {} }))
vi.mock('../utils/hostedQuizzes', () => ({
  fetchAccessGrants: vi.fn(), fetchAllProfiles: vi.fn(), grantAccess: vi.fn(), revokeAccess: vi.fn(), setQuizPublic: vi.fn(),
}))
vi.mock('../utils/quizAdmins', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/quizAdmins')>()),
  fetchQuizAccessUsers: vi.fn(), searchQuizUsers: vi.fn(),
}))

import * as hosted from '../utils/hostedQuizzes'
import * as admins from '../utils/quizAdmins'
import { QuizAccessManager } from './QuizAccessManager'
import { SEARCH_DELAY_MS } from './QuizUserSearch'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocked = (fn: unknown) => fn as ReturnType<typeof vi.fn>
const fetchAllProfiles = mocked(hosted.fetchAllProfiles)
const fetchAccessGrants = mocked(hosted.fetchAccessGrants)
const grantAccess = mocked(hosted.grantAccess)
const revokeAccess = mocked(hosted.revokeAccess)
const setQuizPublic = mocked(hosted.setQuizPublic)
const fetchAccessUsers = mocked(admins.fetchQuizAccessUsers)
const search = mocked(admins.searchQuizUsers)

let container: HTMLDivElement
let root: Root
const onTogglePublic = vi.fn()
const quiz = { id: 'q1', title: 'Mon quiz', is_public: false }

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() })
const mount = async (props: { isGlobalAdmin: boolean; isOwner: boolean; isPublic?: boolean }) => {
  await act(async () => { root.render(createElement(QuizAccessManager, { quiz: { ...quiz, is_public: props.isPublic ?? false }, onTogglePublic, isGlobalAdmin: props.isGlobalAdmin, isOwner: props.isOwner })) })
  await flush()
}
const publicCheckbox = () => container.querySelector('input[type="checkbox"]') as HTMLInputElement

beforeEach(() => {
  vi.useFakeTimers()
  for (const fn of [fetchAllProfiles, fetchAccessGrants, grantAccess, revokeAccess, setQuizPublic, fetchAccessUsers, search, onTogglePublic]) fn.mockReset()
  fetchAllProfiles.mockResolvedValue([{ id: 'u1', pseudo: 'Alice', avatar: '🙂' }, { id: 'u2', pseudo: 'Bob', avatar: '😎' }])
  fetchAccessGrants.mockResolvedValue(['u1'])
  fetchAccessUsers.mockResolvedValue([{ user_id: 'u1', pseudo: 'Alice', avatar: '🙂' }])
  grantAccess.mockResolvedValue(undefined)
  revokeAccess.mockResolvedValue(undefined)
  setQuizPublic.mockResolvedValue(undefined)
  search.mockResolvedValue([])
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers() })

describe('QuizAccessManager — the global administrator', () => {
  it('ticks every account from the full list, as before', async () => {
    await mount({ isGlobalAdmin: true, isOwner: true })
    expect(fetchAllProfiles).toHaveBeenCalled()
    const boxes = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    expect(boxes).toHaveLength(3)
    expect(boxes[1].checked).toBe(true)
    expect(boxes[2].checked).toBe(false)
    expect(container.querySelector('input[type="search"]')).toBeNull()
  })

  it('can make the quiz public', async () => {
    await mount({ isGlobalAdmin: true, isOwner: true })
    expect(publicCheckbox().disabled).toBe(false)
    await act(async () => { publicCheckbox().click() })
    await flush()
    expect(setQuizPublic).toHaveBeenCalledWith('q1', true)
    expect(onTogglePublic).toHaveBeenCalledWith(true)
  })
})

describe('QuizAccessManager — a quiz administrator who is not the global administrator', () => {
  it('never reads the full list of accounts: it lists who has access and searches by pseudo', async () => {
    await mount({ isGlobalAdmin: false, isOwner: false })
    expect(fetchAllProfiles).not.toHaveBeenCalled()
    expect(fetchAccessGrants).not.toHaveBeenCalled()
    expect(fetchAccessUsers).toHaveBeenCalledWith('q1')
    expect(container.querySelector('.quiz-user-results')?.textContent).toContain('Alice')
    expect(container.querySelector('input[type="search"]')).not.toBeNull()
  })

  it('cannot make the quiz public unless owner, and says why', async () => {
    await mount({ isGlobalAdmin: false, isOwner: false })
    expect(publicCheckbox().disabled).toBe(true)
    expect(container.textContent).toContain('Seul un propriétaire du quiz peut le rendre public')
  })

  it('can make it public as an owner', async () => {
    await mount({ isGlobalAdmin: false, isOwner: true })
    expect(publicCheckbox().disabled).toBe(false)
    expect(container.textContent).not.toContain('Seul un propriétaire du quiz peut le rendre public')
  })

  it('removes an access and reloads the list', async () => {
    await mount({ isGlobalAdmin: false, isOwner: false })
    fetchAccessUsers.mockResolvedValue([])
    const revoke = container.querySelector('.quiz-user-results button') as HTMLButtonElement
    expect(revoke.textContent).toBe("Retirer l'accès")
    await act(async () => { revoke.click() })
    await flush()
    expect(revokeAccess).toHaveBeenCalledWith('q1', 'u1')
    expect(container.textContent).toContain("Personne n'a accès à ce quiz pour l'instant.")
  })

  it('gives access to an account found by pseudo, and marks accounts that already have it', async () => {
    search.mockResolvedValue([
      { user_id: 'u1', pseudo: 'Alice', avatar: '🙂', role: null, has_access: true },
      { user_id: 'u3', pseudo: 'Alicia', avatar: '🧙', role: null, has_access: false },
    ])
    await mount({ isGlobalAdmin: false, isOwner: false })
    const input = container.querySelector('input[type="search"]') as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'ali')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => { vi.advanceTimersByTime(SEARCH_DELAY_MS + 10) })
    await flush()
    const found = [...container.querySelectorAll('.quiz-user-search .quiz-user-results li')]
    expect(found[0].textContent).toContain('A déjà accès')
    expect(found[0].querySelector('button')).toBeNull()
    const give = found[1].querySelector('button') as HTMLButtonElement
    expect(give.textContent).toBe("Donner l'accès")
    await act(async () => { give.click() })
    await flush()
    expect(grantAccess).toHaveBeenCalledWith('q1', 'u3')
  })

  it('explains a refusal and shows the real list again', async () => {
    revokeAccess.mockRejectedValue({ message: 'forbidden' })
    await mount({ isGlobalAdmin: false, isOwner: false })
    await act(async () => { (container.querySelector('.quiz-user-results button') as HTMLButtonElement).click() })
    await flush()
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Vous n'avez pas le droit de faire cela sur ce quiz.")
    expect(fetchAccessUsers).toHaveBeenCalledTimes(2)
  })

  it('says it when the quiz is public: the access list is then hidden', async () => {
    await mount({ isGlobalAdmin: false, isOwner: true, isPublic: true })
    expect(container.textContent).toContain('Ce quiz est visible par tous les utilisateurs connectés')
    expect(container.querySelector('input[type="search"]')).toBeNull()
  })
})
