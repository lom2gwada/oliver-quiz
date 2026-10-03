import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n'
import type { TranslationKey } from '../i18n'
import { cleanTranscript, getSpeechRecognition, speechLanguageTag, type SpeechRecognitionLike } from '../utils/dictation'

const ERROR_KEYS: Record<string, TranslationKey | null> = {
  'not-allowed': 'quiz.dictateDenied',
  'service-not-allowed': 'quiz.dictateDenied',
  'no-speech': 'quiz.dictateNoSpeech',
  // Déclenché par notre propre `abort()` (changement de question) : pas une erreur à montrer.
  aborted: null,
}

/** Dicte la réponse d'une question à saisie libre : le texte reconnu est remis tel quel à `onResult`, qui le
 * place dans le champ — rien n'est validé, l'utilisateur relit et corrige à la main si besoin. Masqué quand le
 * navigateur ne sait pas dicter. */
export function DictationButton({ onResult }: { onResult: (text: string) => void }) {
  const { t, language } = useTranslation()
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [listening, setListening] = useState(false)
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const Recognition = getSpeechRecognition()

  useEffect(() => () => recognitionRef.current?.abort(), [])

  if (!Recognition) return null

  const toggle = () => {
    if (listening) { recognitionRef.current?.stop(); return }
    setErrorKey(null)
    const recognition = new Recognition()
    recognition.lang = speechLanguageTag(language)
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.continuous = false
    recognition.onresult = (event) => {
      const text = cleanTranscript(event.results[0][0].transcript)
      if (text) onResult(text)
    }
    recognition.onerror = (event) => setErrorKey(event.error in ERROR_KEYS ? ERROR_KEYS[event.error] : 'quiz.dictateError')
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  return <>
    <button type="button" className="secondary dictation-button" onClick={toggle} aria-pressed={listening}>{listening ? t('quiz.dictateStop') : t('quiz.dictate')}</button>
    {errorKey && <p className="dictation-message" role="status">{t(errorKey)}</p>}
  </>
}
