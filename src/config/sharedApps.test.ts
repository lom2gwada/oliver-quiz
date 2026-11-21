import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { fr } from '../i18n/fr'
import { ALL_APPS, listApps, OTHER_APPS, THIS_APP } from './sharedApps'

describe('listApps', () => {
  it('joins two names with « et » / « and »', () => {
    expect(listApps(OTHER_APPS, 'fr')).toBe('Quiz Forge et Periodic Quiz')
    expect(listApps(OTHER_APPS, 'en')).toBe('Quiz Forge and Periodic Quiz')
  })

  it('joins three names with commas and a last « et » / « and »', () => {
    expect(listApps(ALL_APPS, 'fr')).toBe('Oliver Quiz, Quiz Forge et Periodic Quiz')
    expect(listApps(ALL_APPS, 'en')).toBe('Oliver Quiz, Quiz Forge and Periodic Quiz')
  })

  it('handles one name and none', () => {
    expect(listApps(['Quiz Forge'], 'fr')).toBe('Quiz Forge')
    expect(listApps([], 'en')).toBe('')
  })
})

describe('the shared account', () => {
  it('is shared by this application and the two others', () => {
    expect(THIS_APP).toBe('Oliver Quiz')
    expect([...OTHER_APPS]).toEqual(['Quiz Forge', 'Periodic Quiz'])
    expect([...ALL_APPS]).toEqual(['Oliver Quiz', 'Quiz Forge', 'Periodic Quiz'])
  })
})

/** Tout texte qui annonce la suppression ou la désactivation d'un compte doit dire que ce compte est commun aux autres
 * applications : sinon la conséquence est une surprise (#236). Les noms viennent de `sharedApps.ts`, pas d'une copie. */
describe.each([['fr', fr], ['en', en]] as const)('texts about deleting or disabling an account (%s)', (language, messages) => {
  const dictionary = messages as unknown as Record<string, unknown>
  const text = (key: string, ...args: unknown[]) => {
    const value = dictionary[key]
    return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : String(value)
  }
  const texts: Record<string, string> = {
    'profile.deleteWarning': text('profile.deleteWarning'),
    'profile.deleteConfirm': text('profile.deleteConfirm'),
    'userActions.deleteWarning': text('userActions.deleteWarning'),
    'userActions.disableConfirm': text('userActions.disableConfirm', 'Alice'),
  }

  it.each(Object.keys(texts))('%s names the other applications', (key) => {
    for (const app of OTHER_APPS) expect(texts[key], `${key} mentions ${app}`).toContain(app)
  })

  it('the profile warning also names this application and the shared account', () => {
    expect(texts['profile.deleteWarning']).toContain(listApps(ALL_APPS, language))
  })

  it('never leaves a placeholder or an undefined value in the text', () => {
    for (const value of Object.values(texts)) expect(value).not.toMatch(/undefined|\$\{|\[object/)
  })
})

describe('the account deletion wording of the profile', () => {
  it('in French', () => {
    expect(fr['profile.deleteWarning']).toBe('Cette action est définitive : ton compte, ton profil, ton historique, tes réponses et ta progression de révision sont supprimés. Ton compte est commun à Oliver Quiz, Quiz Forge et Periodic Quiz : tes données dans Quiz Forge et Periodic Quiz sont supprimées aussi. Les quiz que tu as créés (administration) sont conservés, sans ton nom.')
    expect(fr['profile.deleteConfirm']).toBe('Supprimer définitivement ton compte et toutes tes données, y compris dans Quiz Forge et Periodic Quiz (le compte est commun aux trois applications) ? Cette action est irréversible.')
  })

  it('in English', () => {
    expect(en['profile.deleteWarning']).toBe('This cannot be undone: your account, profile, history, answers and review progress are deleted. Your account is shared by Oliver Quiz, Quiz Forge and Periodic Quiz: your data in Quiz Forge and Periodic Quiz is deleted too. Quizzes you created (administration) are kept, without your name.')
    expect(en['profile.deleteConfirm']).toBe('Permanently delete your account and all your data, including in Quiz Forge and Periodic Quiz (the account is shared by all three applications)? This cannot be undone.')
  })
})
