import { useEffect, useState } from 'react'
import type { Difficulty, Question, Quiz } from '../types/quiz'
import type { QuizResultRow, StreakResultRow, TimedResultRow } from '../types/history'
import { useTranslation } from '../i18n'
import type { Language, TranslationKey } from '../i18n'
import { bucketsToChartGroups, bucketsToRadarAxes, computeRecords, computeThemeWeekHeatmap, fetchQuizHistory, fetchStreakHistory, fetchTimedHistory, sumBuckets } from '../utils/quizHistory'
import { computeDueQuestions, fetchQuestionProgress, selectReviewCards, type QuestionProgressRow, type ReviewCard } from '../utils/leitner'
import { longDate, shortDate } from '../utils/dateFormat'
import { formatPercent } from '../utils/format'
import { buildQuizOptions } from '../utils/quizOptions'
import { timedDurationLabel } from '../utils/timedDuration'
import { formatDuration } from '@engine/utils/time'
import { PieChart } from '@engine/components/PieChart'
import { RadarChart } from './RadarChart'
import { difficultyLabel, typeLabel } from './QuizPage'
import { GameDetail } from './GameDetail'
import { mergeGames, type HistoryGame } from '../utils/historyGames'
import { ScoreChart } from './ScoreChart'
import { TabList, tabPanelId } from './TabList'
import { ThemeHeatmap } from './ThemeHeatmap'

/** Tailles de lot proposées pour "Reprendre mes erreurs" — au-delà de quelques dizaines de questions
 * accumulées, tout reprendre d'un coup n'est plus une session de pratique digeste. */
const REPLAY_COUNTS = [10, 20, 30, 50]

type Translate = (key: TranslationKey, ...args: unknown[]) => string

interface HistoryPageProps {
  onBack: () => void
  quiz: Quiz
  hostedQuizId: string
  /** Les quiz auxquels le joueur a accès : la liste du sélecteur est la même que celle du classement. */
  hostedQuizzes: { id: string; title: string }[]
  onReviewDue: (cards: ReviewCard[]) => void
  /** Ouvre le classement du quiz affiché ici (pas forcément le quiz actif de l'appli : le sélecteur de cette page
   * ne change que l'affichage) — `key`/`label` sont ceux de ce quiz dans le sélecteur. */
  onViewLeaderboard: (key: string, label: string) => void
}

/** Une ligne d'historique "appartient" à `quiz_id` si connu, ou à son titre figé sinon (parties d'avant cette
 * colonne, ou quiz source supprimé depuis) — regroupe ainsi deux titres successifs d'un même quiz renommé
 * plutôt que de les traiter comme deux quiz différents. */
const quizKeyOf = (row: { quiz_id: string | null; quiz_title: string }) => row.quiz_id ?? row.quiz_title

type HistoryTab = 'summary' | 'progress' | 'modes' | 'review' | 'games'

const modeLabel = (game: HistoryGame, t: Translate) => t(game.mode === 'classic' ? 'common.modeClassic' : game.mode === 'streak' ? 'common.modeStreak' : 'common.modeTimed')

/** Les colonnes d'une ligne de partie : le résultat propre au mode, la date, les thèmes, puis les points / la durée. */
function gameSummary(game: HistoryGame, t: Translate, language: Language) {
  if (game.mode === 'classic') {
    const { row } = game
    return <>
      <span className="history-score" title={t('metric.pointsShareHint')}>{formatPercent(row.score, language)}</span>
      <span className="history-date">{longDate(row.created_at, language)}</span>
      <span className="history-themes">{row.themes.join(', ')}</span>
      <span>{t('result.pointsEarned', row.earned_points, row.total_points)}</span>
      <span>{t('common.durationIcon', formatDuration(row.elapsed_seconds))}</span>
    </>
  }
  if (game.mode === 'streak') {
    const { row } = game
    return <>
      <span className="history-score">{row.victory ? '🏆' : '🔥'} {row.streak_count}</span>
      <span className="history-date">{longDate(row.created_at, language)}</span>
      <span className="history-themes">{row.themes.join(', ') || t('common.allThemes')}</span>
      <span>{t('common.durationIcon', formatDuration(row.elapsed_seconds))}</span>
    </>
  }
  const { row } = game
  return <>
    <span className="history-score">✅ {row.correct_count} / {row.question_count}</span>
    <span className="history-date">{longDate(row.created_at, language)}</span>
    <span className="history-themes">{row.themes.join(', ') || t('common.allThemes')}</span>
    <span>{timedDurationLabel(row.elapsed_seconds, row.duration_seconds, t)}</span>
  </>
}

export function HistoryPage({ onBack, quiz, hostedQuizId, hostedQuizzes, onReviewDue, onViewLeaderboard }: HistoryPageProps) {
  const { t, language } = useTranslation()
  const [rows, setRows] = useState<QuizResultRow[] | null>(null)
  const [streakRows, setStreakRows] = useState<StreakResultRow[]>([])
  const [timedRows, setTimedRows] = useState<TimedResultRow[]>([])
  const [progress, setProgress] = useState<QuestionProgressRow[]>([])
  const [error, setError] = useState('')
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null)
  const [replayLimit, setReplayLimit] = useState(20)
  const [tab, setTab] = useState<HistoryTab>('summary')
  const [openGameId, setOpenGameId] = useState<string | null>(null)

  useEffect(() => {
    fetchQuizHistory().then(setRows).catch(() => setError(t('history.errorLoad')))
    fetchStreakHistory().then(setStreakRows).catch(() => {})
    fetchTimedHistory().then(setTimedRows).catch(() => {})
  }, [])

  // Contrairement aux autres blocs d'historique, `question_progress` n'a de sens que pour le quiz actuellement
  // chargé : ses lignes ne portent que l'id de question et la boîte, pas le texte — il faut `quiz.questions`
  // pour les résoudre, ce qu'on n'a que pour le quiz actif (voir `canReplay` plus bas).
  useEffect(() => {
    if (!hostedQuizId) { setProgress([]); return }
    fetchQuestionProgress(hostedQuizId).then(setProgress).catch(() => setProgress([]))
  }, [hostedQuizId])

  const activeQuizKey = hostedQuizId || quiz.metadata.title

  // Même liste, même ordre que le sélecteur du classement (voir `buildQuizOptions`). Un même quiz renommé produit deux
  // titres figés différents dans les vieilles lignes : le titre courant du quiz accessible, ou à défaut le plus récent
  // rencontré (les lignes arrivent triées par date décroissante), est celui affiché.
  const seen = [...(rows ?? []), ...streakRows, ...timedRows].map((row) => ({ key: quizKeyOf(row), label: row.quiz_title }))
  const quizOptions = buildQuizOptions({ hosted: hostedQuizzes, seen, active: { key: activeQuizKey, label: quiz.metadata.title }, language })
  const keyLabels = new Map(quizOptions.map((option) => [option.key, option.label]))
  const quizKeys = quizOptions.map((option) => option.key)

  const activeQuiz = selectedQuiz && quizKeys.includes(selectedQuiz) ? selectedQuiz : activeQuizKey
  const quizRows = rows ? rows.filter((row) => quizKeyOf(row) === activeQuiz) : null
  const quizStreakRows = streakRows.filter((row) => quizKeyOf(row) === activeQuiz)
  const bestStreak = quizStreakRows.length ? Math.max(...quizStreakRows.map((row) => row.streak_count)) : 0
  // Une partie contre-la-montre sans aucune question tentée n'a rien à montrer (« ✅ 0 / 0 ») : elle est masquée.
  const quizTimedRows = timedRows.filter((row) => quizKeyOf(row) === activeQuiz && row.question_count > 0)
  const quizGames = mergeGames(quizRows ?? [], quizStreakRows, quizTimedRows)
  const bestTimedCount = quizTimedRows.length ? Math.max(...quizTimedRows.map((row) => row.correct_count)) : 0
  // « Parties jouées » : toutes les parties du quiz, tous modes confondus — comme « Mes quiz ».
  const totalGames = quizGames.length

  const records = quizRows ? computeRecords(quizRows) : null
  const chartPoints = quizRows ? [...quizRows].reverse().map((row) => ({ label: shortDate(row.created_at, language), score: row.score })) : []
  const themeBuckets = quizRows ? sumBuckets(quizRows, (row) => row.by_theme) : {}
  const typeBuckets = quizRows ? sumBuckets(quizRows, (row) => row.by_type) : {}
  const typeAxes = bucketsToRadarAxes(typeBuckets, (key) => typeLabel(t, key as Question['type']))
  // Un radar exige 3 axes : un quiz qui n'a que 1-2 types de questions garde les camemberts.
  const byType = typeAxes.length < 3 ? bucketsToChartGroups(typeBuckets, (key) => typeLabel(t, key as Question['type']), t('result.succeeded'), t('result.missed')) : []
  const byDifficulty = quizRows ? bucketsToChartGroups(sumBuckets(quizRows, (row) => row.by_difficulty), (key) => difficultyLabel(t, key as Difficulty), t('result.succeeded'), t('result.missed')) : []
  const radarAxes = bucketsToRadarAxes(themeBuckets, (key) => key)
  const radarTruncated = Object.keys(themeBuckets).length > radarAxes.length
  const heatmap = computeThemeWeekHeatmap(quizRows ?? [])

  const canReplay = activeQuiz === activeQuizKey
  // `computeDueQuestions` trie de la boîte la plus basse (la plus fragile) à la plus haute ; la session composée au clic
  // (`selectReviewCards`) mêle les plus fragiles et un tirage au hasard parmi le reste, dans un ordre mélangé.
  const dueCards = canReplay ? computeDueQuestions(progress, quiz.questions) : []
  const replayCap = Math.min(replayLimit, dueCards.length)

  // Les sections sans contenu n'ont pas d'onglet ; l'onglet choisi laisse la place au premier disponible quand le quiz
  // affiché n'a rien à y montrer (ex. rien à réviser).
  const tabs: { id: HistoryTab; label: string }[] = [
    ...(totalGames > 0 ? [{ id: 'summary' as const, label: t('history.tabSummary') }] : []),
    ...(records && records.gamesPlayed > 0 ? [{ id: 'progress' as const, label: t('history.tabProgress') }] : []),
    ...(quizStreakRows.length > 0 || quizTimedRows.length > 0 ? [{ id: 'modes' as const, label: t('history.tabModes') }] : []),
    ...(dueCards.length > 0 ? [{ id: 'review' as const, label: t('history.tabReview', dueCards.length) }] : []),
    ...(totalGames > 0 ? [{ id: 'games' as const, label: t('history.tabGames', totalGames) }] : []),
  ]
  const activeTab = tabs.some((item) => item.id === tab) ? tab : tabs[0]?.id

  return <section className="stats-page">
    <div className="stats-header">
      <h2>{t('history.title')}</h2>
      <div className="stats-header-actions">
        <button type="button" className="secondary" onClick={() => onViewLeaderboard(activeQuiz, keyLabels.get(activeQuiz) ?? quiz.metadata.title)}>{t('common.viewLeaderboard')}</button>
        <button type="button" className="secondary" onClick={onBack}>{t('common.back')}</button>
      </div>
    </div>
    {error && <p className="alert" role="alert">{error}</p>}
    {!error && !rows && <p>{t('common.loading')}</p>}
    {rows && !rows.length && <p>{t('history.emptyState')}</p>}
    {quizKeys.length > 0 && <label className="quiz-select">{t('start.quizLabel')}
      <select value={activeQuiz} onChange={(event) => setSelectedQuiz(event.target.value)}>
        {quizOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
    </label>}
    {tabs.length > 0 && activeTab && <>
      <TabList tabs={tabs} value={activeTab} onChange={setTab} label={t('history.tabsLabel')} idPrefix="history" />
      <div role="tabpanel" id={tabPanelId('history')} aria-labelledby={`history-tab-${activeTab}`} className="tab-panel">
        {activeTab === 'summary' && <>
          <div className="records-grid">
            <div className="record-tile"><span className="record-value">{totalGames}</span><span className="record-label">{t('history.gamesPlayed')}</span></div>
            {records && records.gamesPlayed > 0 && <>
              <div className="record-tile"><span className="record-value">{formatPercent(records.bestScore, language)}</span><span className="record-label" title={t('metric.pointsShareHint')}>{t('history.bestPointsShare')}</span></div>
              <div className="record-tile"><span className="record-value">{formatPercent(records.averageScore, language)}</span><span className="record-label" title={t('metric.pointsShareHint')}>{t('history.averagePointsShare')}</span></div>
              <div className="record-tile"><span className="record-value">{formatDuration(records.totalPlaytimeSeconds)}</span><span className="record-label">{t('history.totalPlaytime')}</span></div>
            </>}
          </div>
          {records && records.gamesPlayed > 0 && <div className="stats-groups">
            {byType.length > 0 && <div className="stats-group">
              <h3 className="stats-group-title">{t('history.byType')}</h3>
              <div className="stats-grid">{byType.map((group) => <PieChart key={`type-${group.key}`} title={group.label} data={group.data} />)}</div>
            </div>}
            <div className="stats-group">
              <h3 className="stats-group-title">{t('result.byDifficulty')}</h3>
              <div className="stats-grid">{byDifficulty.map((group) => <PieChart key={`difficulty-${group.key}`} title={group.label} data={group.data} />)}</div>
            </div>
          </div>}
        </>}
        {activeTab === 'progress' && <>
          <ScoreChart points={chartPoints} />
          {radarAxes.length >= 3 && <RadarChart
            title={t('history.radarTitle')}
            axes={radarAxes}
            note={radarTruncated ? t('history.radarNote', radarAxes.length) : undefined}
          />}
          {heatmap.themes.length > 0 && <ThemeHeatmap
            heatmap={heatmap}
            title={t('history.heatmapTitle')}
            note={heatmap.truncated ? t('history.heatmapNote', heatmap.themes.length) : undefined}
          />}
          <RadarChart title={t('history.typeRadarTitle')} axes={typeAxes} />
        </>}
        {activeTab === 'modes' && <>
          <p className="mode-hint games-hint">{t('history.modesHint')}</p>
          {quizStreakRows.length > 0 && <div className="stats-group">
            <h3 className="stats-group-title profile-section-title">{t('history.streakSectionTitle')}</h3>
            <div className="records-grid">
              <div className="record-tile"><span className="record-value">🔥 {bestStreak}</span><span className="record-label">{t('history.bestStreak')}</span></div>
              <div className="record-tile"><span className="record-value">{quizStreakRows.length}</span><span className="record-label">{t('history.modeGames')}</span></div>
            </div>
          </div>}
          {quizTimedRows.length > 0 && <div className="stats-group">
            <h3 className="stats-group-title profile-section-title">{t('history.timedSectionTitle')}</h3>
            <div className="records-grid">
              <div className="record-tile"><span className="record-value">✅ {bestTimedCount}</span><span className="record-label">{t('history.bestCorrect')}</span></div>
              <div className="record-tile"><span className="record-value">{quizTimedRows.length}</span><span className="record-label">{t('history.modeGames')}</span></div>
            </div>
          </div>}
        </>}
        {activeTab === 'review' && dueCards.length > 0 && <div className="missed-questions">
          <div className="stats-group-header">
            <h3 className="stats-group-title">{t('history.dueTitle', dueCards.length)}</h3>
            <label className="question-count">{t('start.questionCountLabel')}
              <select value={replayCap} onChange={(event) => setReplayLimit(Number(event.target.value))}>
                {REPLAY_COUNTS.filter((count) => count < dueCards.length).map((count) => <option key={count} value={count}>{t('start.questionCountOption', count, false)}</option>)}
                <option value={dueCards.length}>{t('start.allQuestionsOption', dueCards.length)}</option>
              </select>
            </label>
            <button type="button" onClick={() => onReviewDue(selectReviewCards(dueCards, replayCap))}>{t('history.reviewButton')}</button>
          </div>
          <ul className="missed-list">
            {dueCards.map(({ question, box }) => <li className="missed-item" key={question.id}>
              <span>{question.question}</span>
              <span className="missed-ratio">{t('history.dueBox', box)}</span>
            </li>)}
          </ul>
        </div>}
        {activeTab === 'games' && quizGames.length > 0 && <>
          <p className="mode-hint games-hint">{t('history.gamesHint')}</p>
          <ul className="history-list">
            {quizGames.map((game) => {
              const open = openGameId === game.id
              return <li key={game.id}>
                <button type="button" className="history-item history-item-button" aria-expanded={open} aria-controls={`game-detail-${game.id}`} onClick={() => setOpenGameId(open ? null : game.id)}>
                  <span className="history-mode">{modeLabel(game, t)}</span>
                  {gameSummary(game, t, language)}
                  <span className="history-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
                </button>
                {open && <div id={`game-detail-${game.id}`}><GameDetail game={{ id: game.id, quiz_id: game.row.quiz_id, by_theme: game.mode === 'classic' ? game.row.by_theme : undefined }} loadedQuiz={canReplay ? quiz : null} /></div>}
              </li>
            })}
          </ul>
        </>}
      </div>
    </>}
  </section>
}
