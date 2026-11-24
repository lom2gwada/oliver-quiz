import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Profile } from '../types/profile'
import type { View } from '../utils/routes'

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: (key: string) => key, language: 'fr' }) }))
vi.mock('./LanguageSwitch', () => ({ LanguageSwitch: () => null }))
vi.mock('./SoundIcon', () => ({ SoundIcon: () => null }))

import { AppBar } from './AppBar'

const player: Profile = { pseudo: 'Alice', avatar: '🦊', theme: 'dark', language: 'fr' }
const admin: Profile = { ...player, isAdmin: true }
const noop = () => {}
const render = (profile: Profile | null, view: View = 'start') => renderToStaticMarkup(createElement(AppBar, {
  view, muted: false, profile, onLanguageChange: noop, onToggleSound: noop, onHome: noop, onProfile: noop, onAdmin: noop, onUsers: noop, onLogout: noop,
}))

describe('AppBar — administration entries', () => {
  it('shows the Quiz and Users entries to an administrator only', () => {
    const asAdmin = render(admin)
    expect(asAdmin).toContain('nav.quiz')
    expect(asAdmin).toContain('nav.users')
    const asPlayer = render(player)
    expect(asPlayer).not.toContain('nav.quiz')
    expect(asPlayer).not.toContain('nav.users')
    expect(render(null)).not.toContain('nav.users')
  })

  it('marks the Users entry as the current page on the users pages, and not the Quiz entry', () => {
    for (const view of ['users', 'userDetail'] as View[]) {
      const html = render(admin, view)
      expect(html).toMatch(/aria-current="page">nav\.users</)
      expect(html).not.toMatch(/aria-current="page">nav\.quiz</)
    }
  })

  it('marks the Quiz entry, and not the Users entry, on the quiz administration pages', () => {
    for (const view of ['quizzes', 'quizDetail'] as View[]) {
      const html = render(admin, view)
      expect(html).toMatch(/aria-current="page">nav\.quiz</)
      expect(html).not.toMatch(/aria-current="page">nav\.users</)
    }
  })
})

describe('AppBar — an administrator of some quizzes who is not the global administrator', () => {
  const renderAsQuizAdmin = (view: View = 'start') => renderToStaticMarkup(createElement(AppBar, {
    view, muted: false, profile: player, administersQuizzes: true, onLanguageChange: noop, onToggleSound: noop, onHome: noop, onProfile: noop, onAdmin: noop, onUsers: noop, onLogout: noop,
  }))

  it('shows the Quiz entry but not the Users entry', () => {
    const html = renderAsQuizAdmin()
    expect(html).toContain('nav.quiz')
    expect(html).not.toContain('nav.users')
  })

  it('marks the Quiz entry as the current page on the quiz administration pages', () => {
    expect(renderAsQuizAdmin('quizDetail')).toMatch(/aria-current="page">nav.quiz</)
  })

  it('shows nothing more to an ordinary player: the entry is for those who administer a quiz', () => {
    expect(render(player)).not.toContain('nav.quiz')
  })
})
