import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: (key: string, ...args: unknown[]) => [key, ...args].join(' '), language: 'fr' }) }))

import { ThemeProgressTable } from './ThemeProgressTable'
import { toThemeProgressView } from '../utils/themeProgress'

const view = (theme_id: string, overrides = {}) => toThemeProgressView({ theme_id, theme_label: theme_id.toUpperCase(), question_count: 10, seen_count: 5, mastered_count: 2, attempts: 8, correct_attempts: 6, ...overrides })
const render = (themes: ReturnType<typeof view>[]) => renderToStaticMarkup(createElement(ThemeProgressTable, { themes }))

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
})
