// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '../i18n/fr'

const signInWithPassword = vi.hoisted(() => vi.fn())
vi.mock('../utils/supabase', () => ({ supabase: { auth: { signInWithPassword } } }))
vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: keyof typeof fr, ...args: unknown[]) => { const value = fr[key] as unknown; return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : value }, language: 'fr' }),
}))

import { Login } from './Login'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

async function fill(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function signIn() {
  await act(async () => { root.render(createElement(Login)) })
  await fill(container.querySelector('input[type=email]') as HTMLInputElement, 'alice@example.com')
  await fill(container.querySelector('input[type=password]') as HTMLInputElement, 'secret')
  await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
}

beforeEach(() => {
  signInWithPassword.mockReset()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe('Login', () => {
  it('says the account is disabled when the server reports a banned user', async () => {
    signInWithPassword.mockResolvedValue({ error: { code: 'user_banned', message: 'User is banned' } })
    await signIn()
    expect(container.querySelector('[role=alert]')?.textContent).toBe('Ce compte a été désactivé. Contactez un administrateur.')
  })

  it('keeps the usual message for a wrong email or password', async () => {
    signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', message: 'Invalid login credentials' } })
    await signIn()
    expect(container.querySelector('[role=alert]')?.textContent).toBe(fr['auth.emailOrPasswordError'])
  })

  it('shows no error after a successful sign-in', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    await signIn()
    expect(container.querySelector('[role=alert]')).toBeNull()
  })
})
