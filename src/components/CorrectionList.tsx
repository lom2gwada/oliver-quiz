import { useEffect, useId, useState } from 'react'
import type { Question, UserAnswer } from '../types/quiz'
import { useTranslation } from '../i18n'
import { correctAnswer, isCorrect, userAnswer } from '../utils/answerCheck'
import { QuestionImage } from '@engine/components/QuestionImage'
import { CorrectionExplanation } from './CorrectionExplanation'
import { MermaidDiagram } from './MermaidDiagram'
import { QuestionReplay } from './QuestionReplay'
import { QuestionTable } from './QuestionTable'
import { ResultActions } from './ResultActions'

/** Une question corrigée : `key` la distingue des autres (en contre-la-montre, la même question peut revenir). */
export interface CorrectionItem {
  key: string
  question: Question
  answer: UserAnswer | undefined
}

type Filter = 'all' | 'wrong' | 'right'

interface CorrectionListProps {
  items: CorrectionItem[]
  /** Les boutons de fin de partie, répétés sous la liste pour ne pas avoir à remonter tout en haut. */
  onRestartSame?: () => void
  onBackToSettings: () => void
}

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** La correction d'une partie, commune aux trois modes. Chaque question est une ligne repliable : les ratées s'ouvrent d'elles-mêmes,
 * les réussies restent repliées. Au-dessus : un filtre (toutes, à revoir, réussies), « Tout déplier » et une grille de numéros, verts
 * ou rouges, qui mène à la question. Sous la liste : les boutons de fin de partie et un retour en haut de page. Rien ici ne touche au
 * score : seul l'affichage de la correction change. */
export function CorrectionList({ items, onRestartSame, onBackToSettings }: CorrectionListProps) {
  const { t } = useTranslation()
  const prefix = useId()
  const [filter, setFilter] = useState<Filter>('all')
  // Ce que le joueur a ouvert ou fermé lui-même ; sans choix, une question est ouverte si elle est ratée.
  const [choice, setChoice] = useState<Record<string, boolean>>({})
  const [pendingScroll, setPendingScroll] = useState<string | null>(null)

  const rows = items.map((item, index) => ({ ...item, index, correct: isCorrect(item.question, item.answer), domId: `${prefix}-${index}` }))
  const isOpen = (row: (typeof rows)[number]) => choice[row.key] ?? !row.correct
  const wrongCount = rows.filter((row) => !row.correct).length
  const counts: Record<Filter, number> = { all: rows.length, wrong: wrongCount, right: rows.length - wrongCount }
  const visible = rows.filter((row) => filter === 'all' || (filter === 'wrong' ? !row.correct : row.correct))
  const allOpen = visible.length > 0 && visible.every(isOpen)

  // Après un clic sur un numéro : la carte est ouverte et affichée ; on la rejoint et on y place le focus.
  useEffect(() => {
    if (!pendingScroll) return
    const card = document.getElementById(pendingScroll)
    card?.scrollIntoView?.({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
    card?.querySelector<HTMLButtonElement>('.correction-toggle')?.focus({ preventScroll: true })
    setPendingScroll(null)
  }, [pendingScroll])

  const goTo = (row: (typeof rows)[number]) => {
    if (filter !== 'all' && !(filter === 'wrong' ? !row.correct : row.correct)) setFilter('all')
    setChoice((previous) => ({ ...previous, [row.key]: true }))
    setPendingScroll(row.domId)
  }
  const toggleAll = () => setChoice((previous) => ({ ...previous, ...Object.fromEntries(visible.map((row) => [row.key, !allOpen])) }))
  const toTop = () => window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })

  const pills: { id: Filter; label: string }[] = [
    { id: 'all', label: t('result.filterAll', counts.all) },
    { id: 'wrong', label: t('result.filterWrong', counts.wrong) },
    { id: 'right', label: t('result.filterRight', counts.right) },
  ]

  return <>
    <h3 className="stats-group-title">{t('result.correctionsTitle', rows.length)}</h3>
    <div className="correction-toolbar" role="group" aria-label={t('result.filterLabel')}>
      {pills.map((pill) => <button key={pill.id} type="button" className="correction-pill" aria-pressed={filter === pill.id} disabled={counts[pill.id] === 0 && pill.id !== 'all'} onClick={() => setFilter(pill.id)}>{pill.label}</button>)}
      {visible.length > 0 && <button type="button" className="text-toggle" onClick={toggleAll}>{allOpen ? t('result.collapseAll') : t('result.expandAll')}</button>}
    </div>
    <nav aria-label={t('result.questionsNav')}>
      <ol className="correction-grid">
        {rows.map((row) => <li key={row.key}>
          <button type="button" className={`correction-chip ${row.correct ? 'correct' : 'incorrect'}`} aria-label={t('result.chipLabel', row.index + 1, row.correct)} onClick={() => goTo(row)}>{row.index + 1}</button>
        </li>)}
      </ol>
    </nav>
    <div className="corrections">{visible.map((row) => {
      const open = isOpen(row)
      const { question, answer, correct } = row
      return <article id={row.domId} className={`correction correction-card ${correct ? 'correct' : 'incorrect'}`} key={row.key}>
        <h3 className="correction-heading">
          <button type="button" className="correction-toggle" aria-expanded={open} aria-controls={`${row.domId}-body`} onClick={() => setChoice((previous) => ({ ...previous, [row.key]: !open }))}>
            <span className="correction-verdict" aria-hidden="true">{correct ? '✓' : '✗'}</span>
            <span className="sr-only">{correct ? t('result.correct') : t('result.incorrect')} — </span>
            <span className="correction-number">{row.index + 1}.</span>
            <span className="correction-title">{question.question}</span>
            <span className="correction-chevron" aria-hidden="true">▾</span>
          </button>
        </h3>
        {open && <div className="correction-body" id={`${row.domId}-body`}>
          {question.imageUrl && <QuestionImage src={question.imageUrl} alt={question.imageAlt} />}
          {question.diagram && <MermaidDiagram chart={question.diagram} />}
          {question.table && <QuestionTable table={question.table} />}
          {!correct && <p><strong>{t('result.yourAnswer')}</strong> {userAnswer(question, answer, t)}</p>}
          {!correct && <p><strong>{t('result.correctAnswerLabel')}</strong> {correctAnswer(question, t)}</p>}
          <CorrectionExplanation text={question.explanation} />
          <QuestionReplay question={question} answer={answer} />
        </div>}
      </article>
    })}</div>
    <div className="correction-footer">
      <ResultActions onRestartSame={onRestartSame} onBackToSettings={onBackToSettings} />
      <button type="button" className="text-toggle" onClick={toTop}>↑ {t('result.backToTop')}</button>
    </div>
  </>
}
