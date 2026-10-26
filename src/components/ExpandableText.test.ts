import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: (key: string) => key, language: 'fr' }) }))

import { ExpandableText } from './ExpandableText'

describe('ExpandableText', () => {
  it('renders the full text, folded by default, with the caller class', () => {
    const html = renderToStaticMarkup(createElement(ExpandableText, { text: 'Une description.', className: 'quiz-description-preview' }))
    expect(html).toContain('Une description.')
    expect(html).toContain('class="expandable-text quiz-description-preview"')
    expect(html).not.toContain('is-expanded')
  })

  it('shows no toggle before the text has been measured as truncated (a short text never gets one)', () => {
    expect(renderToStaticMarkup(createElement(ExpandableText, { text: 'Court.' }))).not.toContain('<button')
  })
})
