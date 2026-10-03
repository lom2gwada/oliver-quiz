import type { Language } from '../i18n/types'

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

/** Le moteur de dictée ajoute volontiers une ponctuation finale ("Paris."), qui ferait rater la comparaison
 * avec la réponse attendue — l'utilisateur peut de toute façon retoucher le champ ensuite. */
export function cleanTranscript(transcript: string): string {
  return transcript.trim().replace(/[.!?…]+$/u, '').trim()
}
