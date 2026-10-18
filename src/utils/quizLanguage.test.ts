import { describe, expect, it } from 'vitest'
import { isKnownQuizLanguage, normalizeQuizLanguage, quizInterfaceLanguage, quizLanguageLabel } from './quizLanguage'

const translate = (key: 'profile.languageFr' | 'profile.languageEn') => (key === 'profile.languageFr' ? 'Français' : 'English')

describe('normalizeQuizLanguage', () => {
  it('retire les espaces et passe en minuscules', () => {
    expect(normalizeQuizLanguage('  EN ')).toBe('en')
    expect(normalizeQuizLanguage('')).toBe('')
  })
})

describe('isKnownQuizLanguage', () => {
  it('connaît fr et en seulement', () => {
    expect(isKnownQuizLanguage('fr')).toBe(true)
    expect(isKnownQuizLanguage('en')).toBe(true)
    expect(isKnownQuizLanguage('de')).toBe(false)
  })
})

describe('quizInterfaceLanguage', () => {
  it('renvoie la langue du quiz quand l’application la gère, quelle que soit la casse', () => {
    expect(quizInterfaceLanguage('en')).toBe('en')
    expect(quizInterfaceLanguage(' FR ')).toBe('fr')
  })
  it('renvoie null pour une langue absente, vide ou non prise en charge', () => {
    expect(quizInterfaceLanguage(undefined)).toBeNull()
    expect(quizInterfaceLanguage('')).toBeNull()
    expect(quizInterfaceLanguage('de')).toBeNull()
  })
})

describe('quizLanguageLabel', () => {
  it('utilise les libellés de l’interface pour fr/en', () => {
    expect(quizLanguageLabel('fr', 'en', translate)).toBe('Français')
    expect(quizLanguageLabel('en', 'fr', translate)).toBe('English')
  })
  it('donne le nom du navigateur pour une autre langue', () => {
    expect(quizLanguageLabel('de', 'fr', translate).toLowerCase()).toContain('allemand')
  })
  it('replie sur le code brut quand il est inexploitable', () => {
    expect(quizLanguageLabel('pas un code!', 'fr', translate)).toBe('pas un code!')
  })
})
