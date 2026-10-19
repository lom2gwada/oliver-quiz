import type { Language } from '../i18n/types'

const KEY = 'oliverquiz-language'
const PENDING_KEY = 'oliverquiz-language-pending'

const isLanguage = (value: string | null): value is Language => value === 'fr' || value === 'en'

/** Dernière langue d'interface utilisée sur cet appareil : sert aux écrans d'avant connexion, qui n'ont pas
 * encore de profil. Tout accès au stockage est protégé (navigation privée, stockage bloqué…). */
export function readStoredLanguage(): Language | null {
  try {
    const stored = localStorage.getItem(KEY)
    return isLanguage(stored) ? stored : null
  } catch {
    return null
  }
}

/** `pending` : choix fait sur un écran d'avant connexion, à reporter dans le profil une fois l'utilisateur connecté
 * (voir `takePendingLanguage`). Un changement fait ailleurs (profil chargé, en-tête) n'est jamais « en attente »,
 * sinon un appareil au stockage périmé écraserait la langue enregistrée sur un autre appareil. */
export function storeLanguage(language: Language, pending = false): void {
  try {
    localStorage.setItem(KEY, language)
    if (pending) localStorage.setItem(PENDING_KEY, '1')
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    /* stockage indisponible : le choix vaut pour la session seulement */
  }
}

/** La langue choisie avant connexion si elle attend d'être reportée dans le profil (et lève l'attente), sinon `null`. */
export function takePendingLanguage(): Language | null {
  try {
    const pending = localStorage.getItem(PENDING_KEY) === '1'
    localStorage.removeItem(PENDING_KEY)
    return pending ? readStoredLanguage() : null
  } catch {
    return null
  }
}
