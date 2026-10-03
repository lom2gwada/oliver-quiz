import { describe, expect, it } from 'vitest'
import { cleanTranscript, speechLanguageTag } from './dictation'

describe('cleanTranscript', () => {
  it('trims surrounding whitespace', () => {
    expect(cleanTranscript('  Paris  ')).toBe('Paris')
  })

  it('drops trailing sentence punctuation added by the speech engine', () => {
    expect(cleanTranscript('Paris.')).toBe('Paris')
    expect(cleanTranscript('Paris !')).toBe('Paris')
    expect(cleanTranscript('Vraiment ?')).toBe('Vraiment')
    expect(cleanTranscript('Et voilà...')).toBe('Et voilà')
  })

  it('keeps punctuation inside the answer', () => {
    expect(cleanTranscript("l'Île-de-France")).toBe("l'Île-de-France")
    expect(cleanTranscript('3.14')).toBe('3.14')
  })

  it('returns an empty string for a transcript made only of punctuation', () => {
    expect(cleanTranscript(' . ')).toBe('')
  })
})

describe('speechLanguageTag', () => {
  it('maps the app language to a speech recognition locale', () => {
    expect(speechLanguageTag('fr')).toBe('fr-FR')
    expect(speechLanguageTag('en')).toBe('en-GB')
  })
})
