import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: (key: string, ...args: unknown[]) => [key, ...args].join(' '), language: 'fr' }) }))

import { ThemeProgressTable } from './ThemeProgressTable'
import { toThemeProgressView } from '../utils/themeProgress'

const view = (theme_id: string, overrides = {}) => toThemeProgressView({ theme_id, theme_label: theme_id.toUpperCase(), question_count: 10, seen_count: 5, mastered_count: 2, attempts: 8, correct_attempts: 6, ...overrides })
const render = (themes: ReturnType<typeof view>[], onPlayTheme?: (themeId: string) => void) => renderToStaticMarkup(createElement(ThemeProgressTable, { themes, onPlayTheme }))

/** Tous les éléments `type` de l'arbre rendu par le composant (appelé directement : son seul hook est simulé ci-dessus). */
function findAll(node: ReactNode, type: string, found: ReactElement<{ onClick?: () => void; children?: ReactNode }>[] = []) {
  if (Array.isArray(node)) node.forEach((child) => findAll(child, type, found))
  else if (isValidElement<{ onClick?: () => void; children?: ReactNode }>(node)) {
    if (node.type === type) found.push(node)
    findAll(node.props.children, type, found)
  }
  return found
}

describe('ThemeProgressTable', () => {
  it('shows one row per theme, in order, with its counts and success rate', () => {
    const html = render([view('a'), view('b', { seen_count: 10, mastered_count: 10 })])
    expect(html.indexOf('>A<')).toBeLessThan(html.indexOf('>B<'))
    expect(html).toContain('5 / 10')
    expect(html).toContain('75')
    expect((html.match(/role="progressbar"/g) ?? []).length).toBe(4)
  })

  it('shows no success rate for a theme that was never played', () => {
    const html = render([view('a', { seen_count: 0, mastered_count: 0, attempts: 0, correct_attempts: 0 })])
    expect(html).toContain('history.themeNeverPlayed')
    expect(html).toMatch(/theme-progress-success"[^>]*><span aria-label="history.themeNeverPlayed">·<\/span>/)
  })

  it('has no play button without a handler', () => {
    expect(render([view('a')])).not.toContain('history.themePlayButton')
  })

  it('offers one play button per theme, named after its theme', () => {
    const html = render([view('a'), view('b')], () => {})
    expect((html.match(/<th scope="col"/g) ?? []).length).toBe(4)
    expect((html.match(/history.themePlayButton/g) ?? []).length).toBe(2)
    expect(html).toContain('aria-label="history.themePlayLabel A"')
    expect(html).toContain('aria-label="history.themePlayLabel B"')
  })

  it('reports the id of the theme whose button was pressed', () => {
    const played: string[] = []
    const tree = ThemeProgressTable({ themes: [view('histoire'), view('sciences')], onPlayTheme: (themeId) => played.push(themeId) })
    const buttons = findAll(tree, 'button')
    expect(buttons).toHaveLength(2)
    buttons[1].props.onClick?.()
    buttons[0].props.onClick?.()
    expect(played).toEqual(['sciences', 'histoire'])
  })
})
