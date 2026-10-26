import type { Language } from '../i18n/types'

/** Faut-il enregistrer ce choix de langue dans le profil ? Oui s'il diffère de la langue **du profil** — et non de celle
 * affichée : un quiz dans une autre langue peut avoir aligné l'interface sans toucher au profil (voir
 * `quizInterfaceLanguage`), auquel cas choisir la langue déjà affichée doit tout de même être enregistré. Sans profil
 * (pas encore chargé), il n'y a rien à enregistrer, et rien non plus quand le profil a déjà cette langue. */
export function shouldSaveLanguage(profileLanguage: Language | undefined, chosen: Language): boolean {
  return profileLanguage !== undefined && profileLanguage !== chosen
}
