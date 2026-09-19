import { useEffect, useMemo, useRef, useState } from 'react'
import type { GuestLinkMode } from '../types/guestLink'
import type { AnswersByQuestion, Quiz } from '../types/quiz'
import { LanguageProvider, useTranslation } from '../i18n'
import { fetchGuestQuiz, submitGuestResult } from '../utils/guestQuiz'
import { MermaidDiagram } from './MermaidDiagram'
import { QuestionImage } from './QuestionImage'
import { QuestionRenderer } from './QuestionRenderer'
import { TYPE_ICONS, typeLabel, withShuffledAnswers } from './QuizPage'
import { correctAnswer, isCorrect, userAnswer } from './ResultPage'

/** Parcours d'un répondant sans compte (lien `?g=<token>`), rendu hors `AuthGate`/`App` : pas de session, pas de
 * profil, donc pas de langue préférée — tout est en français (le contexte de langue vaut 'fr' par défaut,
 * `LanguageProvider` le rend explicite). Volontairement minimal : une question à la fois, pas de chrono, pas de
 * son, pas de filtres. En mode "sondage", `isCorrect` n'est jamais évalué ni affiché. */
export function GuestQuizPage({ token }: { token: string }) {
  return <LanguageProvider language="fr"><main className="app-shell"><GuestQuizLoader token={token} /></main></LanguageProvider>
}

function GuestQuizLoader({ token }: { token: string }) {
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState<{ mode: GuestLinkMode; quiz: Quiz } | 'invalid' | null>(null)

  useEffect(() => {
    fetchGuestQuiz(token)
      .then((result) => setLoaded(result && result.quiz.questions.length ? result : 'invalid'))
      .catch(() => setLoaded('invalid'))
  }, [token])

  if (loaded === null) return <p>{t('common.loading')}</p>
  if (loaded === 'invalid') return <section className="login-page"><p className="eyebrow">OLIVER QUIZ</p><p className="alert" role="alert">{t('guest.invalidLink')}</p></section>
  return <GuestSession token={token} mode={loaded.mode} quiz={loaded.quiz} />
}

function GuestSession({ token, mode, quiz }: { token: string; mode: GuestLinkMode; quiz: Quiz }) {
  const { t } = useTranslation()
  const questions = useMemo(() => quiz.questions.map(withShuffledAnswers), [quiz])
  const [step, setStep] = useState<'name' | 'quiz' | 'done'>('name')
  const [name, setName] = useState('')
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<AnswersByQuestion>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const startedAt = useRef(0)
  const question = questions[current]
  const isTest = mode === 'test'

  const earned = questions.filter((item) => isCorrect(item, answers[item.id])).reduce((sum, item) => sum + item.points, 0)
  const total = questions.reduce((sum, item) => sum + item.points, 0)
  const score = total ? Math.round((earned / total) * 100) : 0

  const start = (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    startedAt.current = Date.now()
    setStep('quiz')
  }

  const finish = async () => {
    setSubmitting(true)
    setSubmitError(false)
    try {
      await submitGuestResult(token, name.trim(), answers, isTest ? score : null, Math.round((Date.now() - startedAt.current) / 1000))
      setStep('done')
    } catch {
      setSubmitError(true)
    } finally {
      setSubmitting(false)
    }
  }

  const header = <header><div><p className="eyebrow">OLIVER QUIZ</p><h1>{quiz.metadata.title}</h1><p>{t('nav.by', quiz.metadata.author)}</p></div></header>

  if (step === 'name') return <>
    {header}
    <section className="login-page">
      {quiz.metadata.description && <p className="quiz-description">{quiz.metadata.description}</p>}
      <p className="mode-hint">{t('guest.questionCount', questions.length)} — {t(isTest ? 'guest.introTest' : 'guest.introSurvey')}</p>
      <form onSubmit={start}>
        <label>{t('guest.nameLabel')}
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder={t('guest.namePlaceholder')} maxLength={80} autoComplete="name" autoFocus required />
        </label>
        <button type="submit" disabled={!name.trim()}>{t('guest.start')}</button>
      </form>
    </section>
  </>

  if (step === 'done') return <>
    {header}
    <section className="results">
      {isTest ? <>
        <div className="score">
          <p>{t('guest.thanksTest', name.trim())}</p>
          <strong>{score}%</strong>
          <span>{t('result.pointsEarned', earned, total)}</span>
        </div>
        <div className="corrections">{questions.map((item) => {
          const correct = isCorrect(item, answers[item.id])
          return <article className={`correction ${correct ? 'correct' : 'incorrect'}`} key={item.id}>
            <h3>{correct ? t('result.correct') : t('result.incorrect')} — {item.question}</h3>
            {item.imageUrl && <QuestionImage src={item.imageUrl} alt={item.imageAlt} />}
            {item.diagram && <MermaidDiagram chart={item.diagram} />}
            {!correct && <p><strong>{t('result.yourAnswer')}</strong> {userAnswer(item, answers[item.id], t)}</p>}
            {!correct && <p><strong>{t('result.correctAnswerLabel')}</strong> {correctAnswer(item, t)}</p>}
            <p>{item.explanation}</p>
          </article>
        })}</div>
      </> : <div className="score">
        <strong>{t('guest.thanksTitle')}</strong>
        <p>{t('guest.thanksSurvey')}</p>
      </div>}
    </section>
  </>

  const isLast = current === questions.length - 1
  const theme = quiz.themes.find((item) => item.id === question.theme)?.label ?? question.theme
  return <>
    {header}
    <section className="quiz-card">
      <div className="question-meta"><span>{TYPE_ICONS[question.type]} {typeLabel(t, question.type)}</span><span>{theme}</span>{isTest && <span>{question.points} pts</span>}</div>
      <div className="quiz-progress"><div className="quiz-progress-fill" style={{ width: `${((current + 1) / questions.length) * 100}%` }} /></div>
      <p className="progress">{t('quiz.questionProgress', current + 1, questions.length)}</p>
      <div className="question-body" key={question.id}>
        {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
        {question.diagram && <MermaidDiagram chart={question.diagram} />}
        {question.type !== 'cloze' && <h2>{question.question}</h2>}
        <QuestionRenderer question={question} answer={answers[question.id]} onChange={(answer) => setAnswers((previous) => ({ ...previous, [question.id]: answer }))} />
      </div>
      {submitError && <p className="alert" role="alert">{t('guest.errorSubmit')}</p>}
      <div className="quiz-actions">
        <button type="button" className="secondary" onClick={() => setCurrent((value) => value - 1)} disabled={current === 0 || submitting}>{t('quiz.previous')}</button>
        {isLast
          ? <button type="button" onClick={finish} disabled={submitting}>{submitting ? t('guest.submitting') : t('guest.finish')}</button>
          : <button type="button" onClick={() => setCurrent((value) => value + 1)}>{t('quiz.next')}</button>}
      </div>
    </section>
  </>
}
