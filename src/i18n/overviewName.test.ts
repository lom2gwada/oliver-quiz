import { describe, expect, it } from 'vitest'
import { en } from './en'
import { fr } from './fr'

/** La page « Mes quiz » doit se reconnaître quel que soit le bouton qui y mène : un seul nom, une seule icône, dans
 * les deux langues. Ce test échoue si un libellé se met à diverger (ex. « Changer de quiz », « Vue d'ensemble »). */
const ICON = '📊'

describe.each([
  ['fr', fr, 'Mes quiz'],
  ['en', en, 'My quizzes'],
] as const)('« Mes quiz » page name (%s)', (_language, messages, name) => {
  it('uses one name for the page title and the breadcrumb', () => {
    expect(messages['overview.title']).toBe(name)
    expect(messages['crumb.overview']).toBe(name)
  })

  it('uses that same name, with the same icon, on every button leading to the page', () => {
    expect(messages['nav.overview']).toBe(`${ICON} ${name}`)
  })

  it('has no other label naming the page (home button, old title)', () => {
    const all = Object.entries(messages).map(([key, value]) => [key, typeof value === 'function' ? '' : value] as const)
    expect(all.filter(([key]) => key === 'start.changeQuiz')).toEqual([])
    expect(all.filter(([, value]) => /Changer de quiz|Change quiz|Vue d'ensemble|^Overview$/.test(value))).toEqual([])
  })
})
