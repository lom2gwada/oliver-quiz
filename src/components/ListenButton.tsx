import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n'
import { getSpeechSynthesis } from '../utils/speech'

/** Lit `text` à voix haute (synthèse vocale du navigateur) ; un second clic arrête la lecture. Elle s'arrête aussi
 * toute seule quand le bouton disparaît — typiquement au changement de question, l'appelant lui donnant une `key`
 * propre à la question. Masqué quand le navigateur ne sait pas lire à voix haute. */
export function ListenButton({ text, languageTag }: { text: string; languageTag: string }) {
  const { t } = useTranslation()
  const synthesis = getSpeechSynthesis()
  const [speaking, setSpeaking] = useState(false)
  const startedRef = useRef(false)

  // Ne coupe que la lecture lancée par ce bouton, jamais celle d'un autre.
  useEffect(() => () => { if (startedRef.current) synthesis?.cancel() }, [synthesis])

  if (!synthesis) return null

  const toggle = () => {
    if (speaking) { synthesis.cancel(); return }
    synthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = languageTag
    utterance.onend = () => { startedRef.current = false; setSpeaking(false) }
    utterance.onerror = () => { startedRef.current = false; setSpeaking(false) }
    startedRef.current = true
    setSpeaking(true)
    synthesis.speak(utterance)
  }

  return <button type="button" className="secondary listen-button" onClick={toggle} aria-pressed={speaking}>{speaking ? t('quiz.listenStop') : t('quiz.listen')}</button>
}
