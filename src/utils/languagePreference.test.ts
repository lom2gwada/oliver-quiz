// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { readStoredLanguage, storeLanguage, takePendingLanguage } from './languagePreference'

describe('language preference', () => {
  beforeEach(() => localStorage.clear())

  it('ne renvoie rien tant qu’aucune langue n’est stockée, ou si la valeur est inconnue', () => {
    expect(readStoredLanguage()).toBeNull()
    localStorage.setItem('oliverquiz-language', 'de')
    expect(readStoredLanguage()).toBeNull()
  })

  it('relit la dernière langue stockée', () => {
    storeLanguage('en')
    expect(readStoredLanguage()).toBe('en')
  })

  it('ne considère pas en attente un changement fait ailleurs qu’avant la connexion', () => {
    storeLanguage('en')
    expect(takePendingLanguage()).toBeNull()
  })

  it('rend la langue choisie avant connexion une seule fois, puis lève l’attente en gardant la langue', () => {
    storeLanguage('en', true)
    expect(takePendingLanguage()).toBe('en')
    expect(takePendingLanguage()).toBeNull()
    expect(readStoredLanguage()).toBe('en')
  })

  it('un changement ultérieur non pending annule une attente restée en suspens', () => {
    storeLanguage('en', true)
    storeLanguage('fr')
    expect(takePendingLanguage()).toBeNull()
  })
})
