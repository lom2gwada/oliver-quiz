import { describe, expect, it } from 'vitest'
import { cleanTranscript } from '@engine/utils/dictation'
import { dictationLanguageTag, speechLanguageTag } from './dictation'

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

describe('dictationLanguageTag', () => {
  it('suit la langue du quiz quand elle est précisée', () => {
    expect(dictationLanguageTag('en', 'fr')).toBe('en-GB')
    expect(dictationLanguageTag('fr', 'en')).toBe('fr-FR')
    expect(dictationLanguageTag(' EN ', 'fr')).toBe('en-GB')
  })

  it('utilise telle quelle une autre langue exploitable', () => {
    expect(dictationLanguageTag('de', 'fr')).toBe('de')
    expect(dictationLanguageTag('PT-BR', 'fr')).toBe('pt-br')
  })

  it("se rabat sur la langue de l'interface si le quiz n'en précise pas ou si le code est inexploitable", () => {
    expect(dictationLanguageTag(undefined, 'en')).toBe('en-GB')
    expect(dictationLanguageTag('', 'fr')).toBe('fr-FR')
    expect(dictationLanguageTag('Français', 'en')).toBe('en-GB')
  })
})
