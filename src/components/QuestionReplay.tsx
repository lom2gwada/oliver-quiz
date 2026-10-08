import { useState } from 'react'
import type { Question, UserAnswer } from '../types/quiz'
import { useTranslation } from '../i18n'
import { QuestionRenderer } from './QuestionRenderer'

/** Remontre la zone de réponse d'une question corrigée telle que le joueur l'avait au moment de répondre : mêmes
 * composants que le jeu, réponses dans l'ordre où elles ont été affichées (la question reçue est celle de la
 * partie, déjà mélangée) et sélection du joueur pré-remplie. Lecture seule — `pointer-events: none` côté CSS
 * pour les poignées de glisser-déposer que `disabled` ne couvre pas. L'énoncé et les médias sont déjà au-dessus,
 * dans la carte de correction. */
export function QuestionReplay({ question, answer }: { question: Question; answer?: UserAnswer }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="secondary replay-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{open ? t('result.replayClose') : t('result.replayOpen')}</button>
    {open && <fieldset className="replay" disabled>
      <QuestionRenderer question={question} answer={answer} onChange={() => {}} />
    </fieldset>}
  </>
}
