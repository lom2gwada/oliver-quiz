import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { nextTabIndex, TabList } from './TabList'

describe('nextTabIndex', () => {
  it('moves with the arrow keys and wraps around', () => {
    expect(nextTabIndex(0, 3, 'ArrowRight')).toBe(1)
    expect(nextTabIndex(2, 3, 'ArrowRight')).toBe(0)
    expect(nextTabIndex(0, 3, 'ArrowLeft')).toBe(2)
  })

  it('jumps to the first and last tab with Home and End', () => {
    expect(nextTabIndex(1, 4, 'Home')).toBe(0)
    expect(nextTabIndex(1, 4, 'End')).toBe(3)
  })

  it('ignores other keys and an empty list', () => {
    expect(nextTabIndex(0, 3, 'Tab')).toBeNull()
    expect(nextTabIndex(0, 3, 'a')).toBeNull()
    expect(nextTabIndex(0, 0, 'ArrowRight')).toBeNull()
  })
})

describe('TabList', () => {
  const html = renderToStaticMarkup(createElement(TabList, {
    tabs: [{ id: 'summary', label: 'Résumé' }, { id: 'games', label: 'Parties' }],
    value: 'games',
    onChange: () => undefined,
    label: 'Sections',
    idPrefix: 'history',
  }))

  it('is a tablist whose tabs point at the shared panel', () => {
    expect(html).toContain('role="tablist"')
    expect(html.match(/role="tab"/g)).toHaveLength(2)
    expect(html.match(/aria-controls="history-panel"/g)).toHaveLength(2)
    expect(html).toContain('id="history-tab-games"')
  })

  it('selects one tab and keeps a single tab stop', () => {
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
    expect(html).toMatch(/aria-selected="true"[^>]*tabindex="0"[^>]*>Parties/)
    expect(html.match(/tabindex="-1"/g)).toHaveLength(1)
  })
})
