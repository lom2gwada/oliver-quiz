import { describe, expect, it } from 'vitest'
import { ABOUT, contactAddress, contactDisplay } from './about'

describe('contact', () => {
  const contact = { user: 'contact', domain: 'example.org' }

  it('assembles the address from its two parts', () => {
    expect(contactAddress(contact)).toBe('contact@example.org')
  })

  it('displays it so that it does not read as an address', () => {
    expect(contactDisplay(contact)).toBe('contact [at] example.org')
    expect(contactDisplay(contact)).not.toContain('@')
  })

  it('has nothing to show without a configured contact', () => {
    expect(contactAddress(null)).toBeNull()
    expect(contactDisplay(null)).toBeNull()
  })
})

describe('ABOUT', () => {
  it('points to a https repository without a trailing slash', () => {
    expect(ABOUT.repoUrl).toMatch(/^https:\/\/.+[^/]$/)
  })

  it('only credits https links', () => {
    for (const entry of [...ABOUT.libraries, ...ABOUT.services]) expect(entry.url.startsWith('https://')).toBe(true)
  })
})
