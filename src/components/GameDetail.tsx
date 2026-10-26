import { useEffect, useState } from 'react'
import type { AnswersByQuestion, Question, Quiz } from '../types/quiz'
import type { GameQuestionRow, QuizResultRow } from '../types/history'
import { useTranslation } from '../i18n'
import { fetchQuizContent } from '../utils/hostedQuizzes'
import { fetchGameQuestions } from '../utils/quizHistory'
import { parseQuiz } from '../utils/quizValidation'
import { correctAnswer, userAnswer } from './ResultPage'

interface GameDetailProps {
  game: QuizResultRow
  /** Le quiz chargé dans l'appli, s'il est celui de cette partie : évite de le relire. */
  loadedQuiz: Quiz | null
}

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; rows: GameQuestionRow[]; questions: Map<string, Question> }

/** Le détail d'une partie classique : totaux par thème, puis chaque question dans l'ordre où elle a été posée, avec la
 * réponse donnée, la bonne réponse et l'explication. Les questions viennent du contenu *actuel* du quiz (retrouvé par
 * `question_id`) ; une question modifiée depuis garde son énoncé d'époque et son verdict, sans correction. Les parties
 * d'avant `035_question_results_game_detail.sql` n'ont pas de questions enregistrées : seuls les totaux sont montrés. */
export function GameDetail({ game, loadedQuiz }: GameDetailProps) {
  const { t } = useTranslation()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const rows = await fetchGameQuestions(game.id)
      let quiz: Quiz | null = loadedQuiz
      if (rows.length && !quiz && game.quiz_id) {
        try { quiz = parseQuiz(await fetchQuizContent(game.quiz_id)) } catch { quiz = null }
      }
      return { rows, questions: new Map((quiz?.questions ?? []).map((question) => [question.id, question])) }
    }
    load().then((result) => { if (!cancelled) setState({ status: 'ready', ...result }) }).catch(() => { if (!cancelled) setState({ status: 'error' }) })
    return () => { cancelled = true }
  }, [game.id])

  const themeTotals = Object.entries(game.by_theme)

  return <div className="game-detail">
    {themeTotals.length > 0 && <ul className="game-detail-themes">
      {themeTotals.map(([theme, bucket]) => <li key={theme}>{t('history.detailThemeTotal', theme, bucket.correct, bucket.total)}</li>)}
    </ul>}
    {state.status === 'loading' && <p className="mode-hint">{t('common.loading')}</p>}
    {state.status === 'error' && <p className="alert" role="alert">{t('history.detailError')}</p>}
    {state.status === 'ready' && state.rows.length === 0 && <p className="mode-hint">{t('history.detailUnavailable')}</p>}
    {state.status === 'ready' && state.rows.length > 0 && <div className="corrections">
      {state.rows.map((row) => {
        const question = state.questions.get(row.question_id)
        const answer = (row.answer ?? undefined) as AnswersByQuestion[string] | undefined
        return <article className={`correction ${row.correct ? 'correct' : 'incorrect'}`} key={row.question_id + row.position}>
          <h4>{row.correct ? t('result.correct') : t('result.incorrect')} — {row.question_text}</h4>
          {question && !row.correct && <p><strong>{t('result.yourAnswer')}</strong> {userAnswer(question, answer, t)}</p>}
          {question && !row.correct && <p><strong>{t('result.correctAnswerLabel')}</strong> {correctAnswer(question, t)}</p>}
          {question && <p>{question.explanation}</p>}
          {!question && <p className="mode-hint">{t('history.detailQuestionGone')}</p>}
        </article>
      })}
    </div>}
  </div>
}
