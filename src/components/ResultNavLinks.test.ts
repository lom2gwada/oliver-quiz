import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: (key: string) => key, language: 'fr' }) }))

import { ResultNavLinks } from './ResultNavLinks'

describe('ResultNavLinks', () => {
  it('propose l’historique, le classement et « Mes quiz »', () => {
    const html = renderToStaticMarkup(createElement(ResultNavLinks, { onViewHistory: () => {}, onViewLeaderboard: () => {}, onViewOverview: () => {} }))
    expect(html.match(/<button/g)).toHaveLength(3)
    for (const label of ['common.viewHistory', 'common.viewLeaderboard', 'nav.overview']) expect(html).toContain(label)
  })

  it('chaque bouton déclenche son propre rappel', () => {
    const onViewHistory = vi.fn()
    const onViewLeaderboard = vi.fn()
    const onViewOverview = vi.fn()
    // Le composant n'utilise qu'un hook simulé : on l'appelle directement pour lire ses boutons.
    const tree = ResultNavLinks({ onViewHistory, onViewLeaderboard, onViewOverview }) as ReactElement<{ children: ReactElement<{ onClick: () => void; children: string }>[] }>
    const buttons = tree.props.children
    expect(buttons.map((button) => button.props.children)).toEqual(['common.viewHistory', 'common.viewLeaderboard', 'nav.overview'])
    buttons[2].props.onClick()
    expect(onViewOverview).toHaveBeenCalledTimes(1)
    expect(onViewHistory).not.toHaveBeenCalled()
    expect(onViewLeaderboard).not.toHaveBeenCalled()
    buttons[0].props.onClick()
    buttons[1].props.onClick()
    expect(onViewHistory).toHaveBeenCalledTimes(1)
    expect(onViewLeaderboard).toHaveBeenCalledTimes(1)
  })
})
