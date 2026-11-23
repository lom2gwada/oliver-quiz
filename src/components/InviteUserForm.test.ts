// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '../i18n/fr'

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: keyof typeof fr, ...args: unknown[]) => { const value = fr[key] as unknown; return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : value }, language: 'fr' }),
}))
vi.mock('../utils/supabase', () => ({ supabase: {} }))
vi.mock('../utils/adminUserActions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/adminUserActions')>()),
  inviteUser: vi.fn(),
}))

import * as actions from '../utils/adminUserActions'
import { InviteUserForm } from './InviteUserForm'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const inviteUser = actions.inviteUser as unknown as ReturnType<typeof vi.fn>
const onInvited = vi.fn(async () => {})
let container: HTMLDivElement
let root: Root

const input = () => container.querySelector('input[type=email]') as HTMLInputElement
const sendButton = () => container.querySelector('button[type=submit]') as HTMLButtonElement
async function type(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value)
    input().dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const submit = () => act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
const alertText = () => container.querySelector('[role=alert]')?.textContent ?? ''
const noticeText = () => container.querySelector('[role=status]')?.textContent ?? ''

beforeEach(async () => {
  vi.clearAllMocks()
  inviteUser.mockResolvedValue(undefined)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root.render(createElement(InviteUserForm, { onInvited })) })
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe('InviteUserForm', () => {
  it('explains what an invitation does, including that the account is shared', () => {
    expect(container.textContent).toContain('Inviter un utilisateur')
    expect(container.textContent).toContain('choisit son mot de passe')
    expect(container.textContent).toContain('Oliver Quiz, Quiz Forge et Periodic Quiz')
  })

  it('keeps the button disabled while the field is empty', async () => {
    expect(sendButton().disabled).toBe(true)
    await type('   ')
    expect(sendButton().disabled).toBe(true)
    await type('alice@example.com')
    expect(sendButton().disabled).toBe(false)
  })

  it('sends the trimmed address, says so, empties the field and lets the list reload', async () => {
    await type('  alice@example.com  ')
    await submit()
    expect(inviteUser).toHaveBeenCalledWith('alice@example.com')
    expect(noticeText()).toBe('Invitation envoyée à alice@example.com.')
    expect(input().value).toBe('')
    expect(onInvited).toHaveBeenCalledWith('alice@example.com')
    expect(alertText()).toBe('')
  })

  it('sends one invitation per submission', async () => {
    await type('alice@example.com')
    await submit()
    expect(inviteUser).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['emailExists', 'Un compte existe déjà avec cette adresse.'],
    ['invalidEmail', 'Adresse email invalide.'],
    ['rateLimited', "Trop d'emails envoyés récemment"],
    ['sendFailed', "L'envoi a échoué"],
    ['unavailable', 'déployée'],
    ['forbidden', 'réservée aux administrateurs'],
  ] as const)('explains a %s refusal and keeps the address for another try', async (failure, text) => {
    inviteUser.mockRejectedValue(new actions.UserActionError(failure))
    await type('alice@example.com')
    await submit()
    expect(alertText()).toContain(text)
    expect(input().value).toBe('alice@example.com')
    expect(onInvited).not.toHaveBeenCalled()
    expect(noticeText()).toBe('')
  })

  it('does not call the invitation a failure when only the reload of the list fails', async () => {
    onInvited.mockRejectedValueOnce(new Error('reload failed'))
    await type('alice@example.com')
    await submit()
    expect(noticeText()).toBe('Invitation envoyée à alice@example.com.')
    expect(alertText()).toBe('')
  })

  it('shows an unexpected error as a generic failure', async () => {
    inviteUser.mockRejectedValue(new Error('boom'))
    await type('alice@example.com')
    await submit()
    expect(alertText()).toBe("L'action a échoué. Réessayez.")
  })
})
