import { useMemo, useState } from 'react'
import type { Question, UserAnswer } from '../types/quiz'
import { useTranslation } from '../i18n'
import { QuestionBody } from './QuestionBody'
import { withShuffledAnswers } from './QuizPage'
import { correctAnswer, isCorrect } from './ResultPage'

/** Aperçu admin d'une question telle que le joueur la voit : même composant de rendu que les parcours de jeu,
 * réponses mélangées comme en partie, et rien n'est enregistré (ni résultat, ni progression de révision). Le
 * bouton "Vérifier" donne la correction à la demande, sans rien révéler tant qu'on ne l'a pas demandée. */
export function QuestionPreview({ question, onClose }: { question: Question; onClose: () => void }) {
  const { t } = useTranslation()
  const shuffled = useMemo(() => withShuffledAnswers(question), [question])
  const [answer, setAnswer] = useState<UserAnswer | undefined>(undefined)
  const [checked, setChecked] = useState(false)
  const check = () => setChecked(true)

  return <>
    <QuestionBody question={shuffled} answer={answer} onChange={(next) => { setAnswer(next); setChecked(false) }} onEnter={check} />
    {checked && <div className="preview-result" role="status">
      <p><strong>{isCorrect(question, answer) ? t('result.correct') : t('result.incorrect')}</strong></p>
      <p><strong>{t('admin.answerLabel')}</strong> {correctAnswer(question, t)}</p>
      <p className="question-list-explanation">{question.explanation}</p>
    </div>}
    <div className="edit-toggle">
      <button type="button" onClick={check}>{t('admin.previewCheckButton')}</button>
      <button type="button" className="secondary" onClick={onClose}>{t('admin.previewCloseButton')}</button>
    </div>
  </>
}
