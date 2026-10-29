import { describe, expect, it } from 'vitest'
import metadata from './quiz-metadata.json'
import { isHttpsUrl, parseQuizImage, parseQuizLinks } from '../utils/quizMeta'

describe('hosted quiz metadata (covers and links)', () => {
  it('has one entry per quiz, identified by a UUID', () => {
    const ids = metadata.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('has covers and links that pass the same validation as an import (https, alternative text, label)', () => {
    for (const entry of metadata) {
      expect(() => parseQuizImage((entry as { image?: unknown }).image), entry.title).not.toThrow()
      expect(() => parseQuizLinks((entry as { links?: unknown }).links), entry.title).not.toThrow()
    }
  })

  it('gives every quiz at least one link to its source', () => {
    for (const entry of metadata) expect(((entry as { links?: unknown[] }).links ?? []).length, entry.title).toBeGreaterThan(0)
  })

  it('has no tracking parameters in a link (utm_, tag=, ref=, campaign ids)', () => {
    const urls = metadata.flatMap((entry) => ((entry as { links?: { url: string }[] }).links ?? []).map((link) => link.url))
    for (const url of urls) expect(url, url).not.toMatch(/[?&](utm_|tag=|ref=|mcid=|hvadid=|psc=)/)
  })

  it('flags purchase links as commercial and only those', () => {
    const links = metadata.flatMap((entry) => (entry as { links?: { url: string; commercial?: boolean }[] }).links ?? [])
    for (const link of links) expect(Boolean(link.commercial), link.url).toBe(/amazon\.|fnac\.|librairie/.test(link.url))
  })

  it('only uses https for cover images', () => {
    for (const entry of metadata) {
      const image = (entry as { image?: { url: string } }).image
      if (image) expect(isHttpsUrl(image.url), entry.title).toBe(true)
    }
  })
})
