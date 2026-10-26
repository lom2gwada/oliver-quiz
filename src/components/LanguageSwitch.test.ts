import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: (key: string) => key, language: 'fr' }) }))

import { LanguageSwitch } from './LanguageSwitch'

type ButtonProps = { 'aria-pressed': boolean; onClick: () => void; children: string }

/** Les boutons FR / EN du sélecteur, lus dans l'élément rendu (pas de DOM nécessaire). */
function buttonsOf(value: 'fr' | 'en', onChange: (next: 'fr' | 'en') => void): ButtonProps[] {
  const root = LanguageSwitch({ value, onChange }) as ReactElement<{ children: ReactElement<ButtonProps>[] }>
  return root.props.children.map((button) => button.props)
}

describe('LanguageSwitch', () => {
  it('marks the displayed language as pressed', () => {
    const [fr, en] = buttonsOf('fr', () => undefined)
    expect([fr['aria-pressed'], en['aria-pressed']]).toEqual([true, false])
  })

  it('reports a click on the other language', () => {
    const onChange = vi.fn()
    buttonsOf('fr', onChange)[1].onClick()
    expect(onChange).toHaveBeenCalledWith('en')
  })

  it('also reports a click on the language that is already displayed, so the choice can be saved (#186)', () => {
    const onChange = vi.fn()
    buttonsOf('fr', onChange)[0].onClick()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('fr')
  })
})
