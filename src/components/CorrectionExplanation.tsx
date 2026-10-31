import { useTranslation } from '../i18n'
import { dictationLanguageTag } from '../utils/dictation'
import { useQuizLanguage } from '../utils/quizLanguageContext'
import { explanationToSpeech } from '../utils/speech'
import { ListenButton } from './ListenButton'

/** L'explication d'une réponse dans une correction, avec un bouton pour l'écouter. Lue dans la langue du quiz (celle de
 * l'interface s'il n'en précise pas) ; `quizLanguage` la donne quand le quiz affiché n'est pas celui de l'appli
 * (détail d'une partie d'un autre quiz dans l'historique). */
export function CorrectionExplanation({ text, quizLanguage }: { text: string; quizLanguage?: string }) {
  const { t, language } = useTranslation()
  const contextLanguage = useQuizLanguage()
  const speech = explanationToSpeech(text)
  return <>
    <p>{text}</p>
    {speech && <ListenButton text={speech} languageTag={dictationLanguageTag(quizLanguage ?? contextLanguage, language)} label={t('result.listenExplanation')} />}
  </>
}
