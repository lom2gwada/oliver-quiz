import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: (key: string) => key, language: 'fr' }) }))

import { FurtherReading } from './FurtherReading'

type Node = ReactElement<{ children: unknown; href?: string; target?: string; rel?: string }>

/** Les <li> du bloc rendu (pas de DOM nécessaire). */
function itemsOf(links: Parameters<typeof FurtherReading>[0]['links']): Node[] {
  const root = FurtherReading({ links }) as ReactElement<{ children: Node[] }> | null
  if (!root) return []
  const list = root.props.children[1] as unknown as ReactElement<{ children: Node[] }>
  return list.props.children
}

describe('FurtherReading', () => {
  it('renders nothing without links', () => {
    expect(FurtherReading({ links: undefined })).toBeNull()
    expect(FurtherReading({ links: [] })).toBeNull()
  })

  it('opens each link in a new tab with noopener noreferrer, in the authored order', () => {
    const items = itemsOf([{ label: 'Site officiel', url: 'https://a.org' }, { label: 'Le livre', url: 'https://b.org', commercial: true }])
    expect(items).toHaveLength(2)
    const anchors = items.map((item) => (item.props.children as Node[])[0])
    expect(anchors.map((anchor) => anchor.props.href)).toEqual(['https://a.org', 'https://b.org'])
    for (const anchor of anchors) {
      expect(anchor.props.target).toBe('_blank')
      expect(anchor.props.rel).toBe('noopener noreferrer')
    }
  })

  it('flags only the commercial link', () => {
    const [plain, shop] = itemsOf([{ label: 'Site officiel', url: 'https://a.org' }, { label: 'Le livre', url: 'https://b.org', commercial: true }])
    expect((plain.props.children as unknown[])[1]).toBeFalsy()
    expect((shop.props.children as unknown[])[1]).toBeTruthy()
  })
})
