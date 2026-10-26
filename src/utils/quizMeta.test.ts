import { describe, expect, it } from 'vitest'
import { imageIssue, isHttpsUrl, linkIssue, parseQuizImage, parseQuizLinks } from './quizMeta'
import { parseQuiz, serializeQuiz } from './quizValidation'

describe('isHttpsUrl', () => {
  it('accepts https URLs only', () => {
    expect(isHttpsUrl('https://example.com/cover.jpg')).toBe(true)
    expect(isHttpsUrl('  https://example.com  ')).toBe(true)
    expect(isHttpsUrl('http://example.com/cover.jpg')).toBe(false)
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpsUrl('data:image/png;base64,AAAA')).toBe(false)
    expect(isHttpsUrl('//example.com/cover.jpg')).toBe(false)
    expect(isHttpsUrl('not a url')).toBe(false)
    expect(isHttpsUrl('')).toBe(false)
  })
})

describe('imageIssue / linkIssue', () => {
  it('reports the URL before the missing alternative text', () => {
    expect(imageIssue({ url: 'http://x.org/a.png', alt: '' })).toBe('url')
    expect(imageIssue({ url: 'https://x.org/a.png', alt: '  ' })).toBe('alt')
    expect(imageIssue({ url: 'https://x.org/a.png', alt: 'Couverture' })).toBeNull()
  })

  it('requires a label and an https URL for a link', () => {
    expect(linkIssue({ label: '', url: 'https://x.org' })).toBe('label')
    expect(linkIssue({ label: 'Site', url: 'http://x.org' })).toBe('url')
    expect(linkIssue({ label: 'Site', url: 'https://x.org' })).toBeNull()
  })
})

describe('parseQuizImage', () => {
  it('treats an absent image as no image', () => {
    expect(parseQuizImage(undefined)).toBeUndefined()
  })

  it('returns the trimmed image', () => {
    expect(parseQuizImage({ url: ' https://x.org/a.png ', alt: ' Couverture ' })).toEqual({ url: 'https://x.org/a.png', alt: 'Couverture' })
  })

  it('rejects a non-https URL with an explicit message', () => {
    expect(() => parseQuizImage({ url: 'http://x.org/a.png', alt: 'Couverture' })).toThrow('metadata.image.url')
  })

  it('rejects a missing or blank alternative text', () => {
    expect(() => parseQuizImage({ url: 'https://x.org/a.png' })).toThrow('metadata.image.alt')
    expect(() => parseQuizImage({ url: 'https://x.org/a.png', alt: '  ' })).toThrow('metadata.image.alt')
  })

  it('rejects something that is not an object with a url', () => {
    expect(() => parseQuizImage('https://x.org/a.png')).toThrow('metadata.image')
    expect(() => parseQuizImage({ alt: 'Couverture' })).toThrow('metadata.image')
    expect(() => parseQuizImage(null)).toThrow('metadata.image')
  })
})

describe('parseQuizLinks', () => {
  it('treats absent and empty lists as no links', () => {
    expect(parseQuizLinks(undefined)).toBeUndefined()
    expect(parseQuizLinks([])).toBeUndefined()
  })

  it('keeps the order and only keeps commercial when it is true', () => {
    expect(parseQuizLinks([
      { label: 'Acheter le livre', url: 'https://shop.example/book', commercial: true },
      { label: ' Site officiel ', url: 'https://example.org', commercial: false },
    ])).toEqual([
      { label: 'Acheter le livre', url: 'https://shop.example/book', commercial: true },
      { label: 'Site officiel', url: 'https://example.org' },
    ])
  })

  it('names the faulty link when the URL is not https', () => {
    expect(() => parseQuizLinks([{ label: 'A', url: 'https://a.org' }, { label: 'B', url: 'ftp://b.org' }])).toThrow('metadata.links[1].url')
  })

  it('rejects a blank label, a non-boolean commercial flag and a non-list', () => {
    expect(() => parseQuizLinks([{ label: ' ', url: 'https://a.org' }])).toThrow('metadata.links[0].label')
    expect(() => parseQuizLinks([{ label: 'A', url: 'https://a.org', commercial: 'oui' }])).toThrow('commercial')
    expect(() => parseQuizLinks({ label: 'A', url: 'https://a.org' })).toThrow('metadata.links')
  })
})

describe('parseQuiz — image and links metadata', () => {
  const quiz = (metadata: Record<string, unknown>) => ({
    version: '1.0',
    metadata: { title: 'Test', author: 'Test', createdAt: '2026-01-01', ...metadata },
    themes: [{ id: 'general', label: 'Général' }],
    questions: [],
  })

  it('still accepts a quiz without image nor links, and adds neither key', () => {
    const parsed = parseQuiz(quiz({}))
    expect(parsed.metadata).not.toHaveProperty('image')
    expect(parsed.metadata).not.toHaveProperty('links')
  })

  it('keeps a valid image and links through parse and serialize', () => {
    const metadata = {
      image: { url: 'https://x.org/a.png', alt: 'Couverture' },
      links: [{ label: 'Acheter le livre', url: 'https://shop.example/book', commercial: true }],
    }
    const parsed = parseQuiz(quiz(metadata))
    expect(parsed.metadata.image).toEqual(metadata.image)
    expect(parsed.metadata.links).toEqual(metadata.links)
    expect(serializeQuiz(parsed).metadata).toMatchObject(metadata)
  })

  it('rejects an import whose image URL is not https', () => {
    expect(() => parseQuiz(quiz({ image: { url: 'http://x.org/a.png', alt: 'Couverture' } }))).toThrow('metadata.image.url')
  })

  it('rejects an import whose image has no alternative text', () => {
    expect(() => parseQuiz(quiz({ image: { url: 'https://x.org/a.png' } }))).toThrow('metadata.image.alt')
  })

  it('rejects an import with an invalid link', () => {
    expect(() => parseQuiz(quiz({ links: [{ label: 'Site', url: 'javascript:alert(1)' }] }))).toThrow('metadata.links[0].url')
  })
})
