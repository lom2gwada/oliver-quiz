import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n'
import { speakSentences, speechDiagnostics, speechSupported, stopSpeaking } from '@engine/utils/speech'

/** Le bouton dont la lecture est en cours : en démarrer un autre coupe la sienne (le moteur ne prévient pas un bouton
 * dont la lecture est remplacée), il doit donc revenir à « Écouter » de lui-même. */
let resetCurrent: (() => void) | null = null

/** Lit `text` à voix haute (synthèse vocale du navigateur) ; un second clic arrête la lecture. Elle s'arrête aussi
 * toute seule quand le bouton disparaît — typiquement au changement de question, l'appelant lui donnant une `key`
 * propre à la question. Masqué quand le navigateur ne sait pas lire à voix haute. La lecture elle-même (fiabilité
 * sur mobile, second essai, diagnostic) vient du moteur commun. */
export function ListenButton({ text, languageTag, label }: { text: string; languageTag: string; label?: string }) {
  const { t } = useTranslation()
  const [speaking, setSpeaking] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const startedRef = useRef(false)

  const reset = useCallback(() => { startedRef.current = false; setSpeaking(false) }, [])

  // Ne coupe que la lecture lancée par ce bouton, jamais celle d'un autre.
  useEffect(() => () => {
    if (startedRef.current) stopSpeaking()
    if (resetCurrent === reset) resetCurrent = null
  }, [reset])

  if (!speechSupported()) return null

  const toggle = () => {
    if (speaking) { reset(); stopSpeaking(); return }
    resetCurrent?.()
    resetCurrent = reset
    setFailed(null)
    startedRef.current = true
    setSpeaking(true)
    speakSentences([text], languageTag, reset, (code) => setFailed(`${code} · ${speechDiagnostics(languageTag)}`))
  }

  return <>
    <button type="button" className="secondary listen-button" onClick={toggle} aria-pressed={speaking}>{speaking ? t('quiz.listenStop') : (label ?? t('quiz.listen'))}</button>
    {failed && <p className="dictation-message" role="status">{t('quiz.listenError')} ({failed})</p>}
  </>
}
