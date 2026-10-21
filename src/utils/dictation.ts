import type { Language } from '../i18n/types'

// `cleanTranscript` (ponctuation finale ajoutée par le moteur de dictée) est partagé : `@engine/utils/dictation`.

/** Sous-ensemble minimal de l'API Web Speech utilisé ici : `lib.dom` de TypeScript ne déclare pas le
 * constructeur `SpeechRecognition` (ni son préfixe `webkit`), seulement les types de résultats. */
export interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

/** `undefined` si le navigateur ne sait pas dicter (Firefox notamment) : le bouton de dictée est alors masqué. */
export function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  const scope = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition
}

export function speechLanguageTag(language: Language): string {
  return language === 'en' ? 'en-GB' : 'fr-FR'
}

/** Forme minimale d'un code de langue exploitable par le moteur de dictée (« de », « pt-br »…) : un texte libre
 * comme « Français » ne l'est pas et ferait échouer la dictée. */
const LANGUAGE_CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i

/** Langue de dictée : celle du quiz quand elle est précisée (fr/en avec leur variante habituelle, tout autre code
 * exploitable tel quel — le moteur sait dicter bien d'autres langues que l'interface), sinon celle de l'interface. */
export function dictationLanguageTag(quizLanguage: string | undefined, uiLanguage: Language): string {
  const code = (quizLanguage ?? '').trim().toLowerCase()
  if (code === 'fr' || code === 'en') return speechLanguageTag(code)
  return LANGUAGE_CODE.test(code) ? code : speechLanguageTag(uiLanguage)
}
