import { describe, expect, it } from 'vitest'
import { shouldSaveLanguage } from './languageChoice'

describe('shouldSaveLanguage', () => {
  it('saves a language that differs from the profile', () => {
    expect(shouldSaveLanguage('en', 'fr')).toBe(true)
    expect(shouldSaveLanguage('fr', 'en')).toBe(true)
  })

  it('does not send a pointless request when the profile already has that language', () => {
    expect(shouldSaveLanguage('fr', 'fr')).toBe(false)
    expect(shouldSaveLanguage('en', 'en')).toBe(false)
  })

  it('saves the choice of the language already displayed when the quiz, not the profile, set it (profile EN, quiz FR, click FR)', () => {
    // La langue affichée est « fr » (imposée par le quiz) ; le profil dit « en » : choisir FR doit être enregistré.
    const displayed = 'fr'
    expect(shouldSaveLanguage('en', displayed)).toBe(true)
  })

  it('has nothing to save while the profile is not loaded yet', () => {
    expect(shouldSaveLanguage(undefined, 'fr')).toBe(false)
  })
})
