import type { Language } from '../i18n/types'

/** Cette application, et les deux autres qui partagent son projet Supabase : un compte est COMMUN aux trois (leurs tables
 * `quiz_forge_*` et `periodic_*` sont `on delete cascade` vers `auth.users`). Désactiver ou supprimer un compte les touche donc
 * toutes ; les textes qui le disent (profil, administration) s'appuient sur ces noms plutôt que de les répéter. */
export const THIS_APP = 'Oliver Quiz'
export const OTHER_APPS = ['Quiz Forge', 'Periodic Quiz'] as const
export const ALL_APPS = [THIS_APP, ...OTHER_APPS] as const

const AND: Record<Language, string> = { fr: 'et', en: 'and' }

/** Une liste de noms en langage courant : « Quiz Forge et Periodic Quiz », « Oliver Quiz, Quiz Forge and Periodic Quiz » (sans virgule
 * avant le dernier « and », comme le reste des textes anglais de l'application). */
export function listApps(apps: readonly string[], language: Language): string {
  if (apps.length <= 1) return apps.join('')
  return `${apps.slice(0, -1).join(', ')} ${AND[language]} ${apps[apps.length - 1]}`
}
