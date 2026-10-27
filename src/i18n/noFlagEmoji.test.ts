import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { en } from './en'
import { fr } from './fr'

/** Les drapeaux emoji sont deux « indicateurs régionaux » (U+1F1E6–U+1F1FF) : Windows ne les dessine pas et n'affiche que
 * les deux lettres (« 🇫🇷 Français » devenait « FR Français »). On nomme la langue en toutes lettres. */
const FLAG = /[\u{1F1E6}-\u{1F1FF}]/u

describe('language indicators', () => {
  it('names a language in words, with no flag emoji, in the interface texts', () => {
    for (const [name, messages] of [['fr', fr], ['en', en]] as const) {
      const flagged = Object.entries(messages).filter(([, value]) => typeof value === 'string' && FLAG.test(value)).map(([key]) => key)
      expect(flagged, name).toEqual([])
    }
  })

  it('shows « Français » and « English » for the two languages of the app', () => {
    for (const messages of [fr, en]) {
      expect(messages['profile.languageFr']).toBe('Français')
      expect(messages['profile.languageEn']).toBe('English')
    }
  })

  it('has no flag emoji anywhere in the source code either', () => {
    const files: string[] = []
    const collect = (directory: URL) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) collect(new URL(`${entry.name}/`, directory))
        else if (/\.(ts|tsx|css)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) files.push(new URL(entry.name, directory).pathname)
      }
    }
    collect(new URL('../', import.meta.url))
    expect(files.length).toBeGreaterThan(50)
    const flagged = files.filter((file) => FLAG.test(readFileSync(decodeURIComponent(file).replace(/^\/([A-Za-z]:)/, '$1'), 'utf8')))
    expect(flagged).toEqual([])
  })
})
