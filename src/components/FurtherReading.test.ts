import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: (key: string) => key, language: 'fr' }) }))

import { FurtherReading, FurtherReadingInline } from './FurtherReading'

type Links = Parameters<typeof FurtherReading>[0]['links']
const block = (links: Links) => renderToStaticMarkup(createElement(FurtherReading, { links }))
const inline = (links: Links) => renderToStaticMarkup(createElement(FurtherReadingInline, { links }))

const links: Links = [{ label: 'Site officiel', url: 'https://a.org' }, { label: 'Le livre', url: 'https://b.org', commercial: true }]

describe.each([['FurtherReading', block], ['FurtherReadingInline (home page)', inline]] as const)('%s', (_name, render) => {
  it('renders nothing without links', () => {
    expect(render(undefined)).toBe('')
    expect(render([])).toBe('')
  })

  it('says what the links are for and opens each one in a new tab with noopener noreferrer, in the authored order', () => {
    const html = render(links)
    expect(html).toContain('links.title')
    expect((html.match(/<a /g) ?? []).length).toBe(2)
    expect(html.match(/target="_blank" rel="noopener noreferrer"/g)).toHaveLength(2)
    expect(html.indexOf('href="https://a.org"')).toBeLessThan(html.indexOf('href="https://b.org"'))
  })

  it('flags only the commercial link', () => {
    expect(render(links).match(/link-commercial/g)).toHaveLength(1)
  })

  it('tells assistive technology that a link opens in a new tab', () => {
    expect(render(links).match(/links\.newTab/g)).toHaveLength(2)
  })
})
