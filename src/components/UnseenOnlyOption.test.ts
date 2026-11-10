import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/en'
import { fr } from '../i18n/fr'

vi.mock('@engine/utils/sound', () => ({ playClick: vi.fn() }))
vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: keyof typeof fr, ...args: number[]) => { const value = fr[key] as unknown; return typeof value === 'function' ? (value as (...a: number[]) => string)(...args) : value }, language: 'fr' }),
}))

import { UnseenOnlyOption } from './UnseenOnlyOption'

const render = (props: { checked: boolean; unseenCount: number; drawnCount: number }) =>
  renderToStaticMarkup(createElement(UnseenOnlyOption, { ...props, onChange: () => {} }))

describe('UnseenOnlyOption', () => {
  it('propose la case avec le nombre de questions à découvrir', () => {
    const html = render({ checked: false, unseenCount: 37, drawnCount: 10 })
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('Seulement des questions non découvertes (37 dans cette sélection)')
    expect(html).not.toContain('checked')
  })

  it("n'explique rien tant que la case n'est pas cochée", () => {
    expect(render({ checked: false, unseenCount: 3, drawnCount: 10 })).not.toContain('unseen-hint')
  })

  it('confirme que tout sera nouveau quand il y a assez de questions à découvrir', () => {
    const html = render({ checked: true, unseenCount: 10, drawnCount: 10 })
    expect(html).toContain('checked')
    expect(html).toContain('Toutes les questions tirées seront nouvelles pour vous.')
  })

  it('annonce le complément quand il y a moins de questions à découvrir que de questions tirées', () => {
    expect(render({ checked: true, unseenCount: 3, drawnCount: 10 })).toContain('Seulement 3 questions sont à découvrir dans cette sélection : les 7 autres seront tirées au hasard parmi celles déjà vues.')
    expect(render({ checked: true, unseenCount: 1, drawnCount: 2 })).toContain('Une seule question est à découvrir dans cette sélection : l&#x27;autre sera tirée au hasard parmi celles déjà vues.')
  })

  it('prévient quand la sélection ne contient plus rien à découvrir', () => {
    expect(render({ checked: true, unseenCount: 0, drawnCount: 10 })).toContain('Aucune question à découvrir dans cette sélection')
  })
})

describe('textes anglais', () => {
  it('suivent les mêmes cas que les français', () => {
    expect(en['start.unseenHint'](10, 10)).toBe('All the questions drawn will be new to you.')
    expect(en['start.unseenHint'](3, 10)).toBe('Only 3 questions are left to discover in this selection: the other 7 will be drawn at random from those already seen.')
    expect(en['start.unseenHint'](1, 2)).toBe('Only one question is left to discover in this selection: the other one will be drawn at random from those already seen.')
    expect(en['start.unseenHint'](0, 10)).toBe('Nothing left to discover in this selection: the usual draw applies.')
  })
})
