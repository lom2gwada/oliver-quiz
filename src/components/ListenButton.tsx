import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n'
import { speakSentences, speechDiagnostics, speechSupported, stopSpeaking } from '@engine/utils/speech'

/** Lit `text` à voix haute (synthèse vocale du navigateur) ; un second clic arrête la lecture. Elle s'arrête aussi
 * toute seule quand le bouton disparaît — typiquement au changement de question, l'appelant lui donnant une `key`
 * propre à la question. Masqué quand le navigateur ne sait pas lire à voix haute. La lecture elle-même (fiabilité
 * sur mobile, second essai, diagnostic) vient du moteur commun. */
export function ListenButton({ text, languageTag }: { text: string; languageTag: string }) {
  const { t } = useTranslation()
  const [speaking, setSpeaking] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const startedRef = useRef(false)

  // Ne coupe que la lecture lancée par ce bouton, jamais celle d'un autre.
  useEffect(() => () => { if (startedRef.current) stopSpeaking() }, [])

  if (!speechSupported()) return null

  const toggle = () => {
    if (speaking) { startedRef.current = false; stopSpeaking(); setSpeaking(false); return }
    setFailed(null)
    startedRef.current = true
    setSpeaking(true)
    speakSentences([text], languageTag, () => { startedRef.current = false; setSpeaking(false) }, (code) => setFailed(`${code} · ${speechDiagnostics(languageTag)}`))
  }

  return <>
    <button type="button" className="secondary listen-button" onClick={toggle} aria-pressed={speaking}>{speaking ? t('quiz.listenStop') : t('quiz.listen')}</button>
    {failed && <p className="dictation-message" role="status">{t('quiz.listenError')} ({failed})</p>}
  </>
}
