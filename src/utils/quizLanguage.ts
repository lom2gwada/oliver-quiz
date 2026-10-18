import type { Language } from '../i18n/types'

/** Langues que l'application connaît (interface et, plus tard, reconnaissance vocale). Tout autre code est
 * accepté tel quel — `metadata.language` n'est jamais refusé, seulement signalé (voir `isKnownQuizLanguage`). */
export const KNOWN_QUIZ_LANGUAGES: Language[] = ['fr', 'en']

/** Espaces retirés et minuscules : « EN », « en » et « en  » désignent la même langue. */
export const normalizeQuizLanguage = (raw: string): string => raw.trim().toLowerCase()

export const isKnownQuizLanguage = (code: string): boolean => (KNOWN_QUIZ_LANGUAGES as string[]).includes(code)

/** Langue de l'interface à adopter au chargement d'un quiz : sa langue si l'application la gère (fr/en),
 * sinon `null` — langue absente, vide ou non prise en charge, auquel cas l'interface ne change pas. */
export function quizInterfaceLanguage(code: string | undefined): Language | null {
  const normalized = normalizeQuizLanguage(code ?? '')
  return isKnownQuizLanguage(normalized) ? (normalized as Language) : null
}

/** Nom affichable d'une langue : libellés de l'interface pour fr/en, sinon le nom du navigateur
 * (`Intl.DisplayNames`, ex. « allemand ») avec repli sur le code brut s'il est inconnu ou mal formé. */
export function quizLanguageLabel(code: string, uiLanguage: Language, translate: (key: 'profile.languageFr' | 'profile.languageEn') => string): string {
  if (code === 'fr') return translate('profile.languageFr')
  if (code === 'en') return translate('profile.languageEn')
  try {
    return new Intl.DisplayNames([uiLanguage], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}
