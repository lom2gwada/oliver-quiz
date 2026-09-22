import type { AnswersByQuestion, Question, QuestionAttempt, Theme } from '../types/quiz'
import type { ChartGroup, MissedQuestion, QuestionResultPayload, QuestionResultRow, QuizRecords, QuizResultPayload, QuizResultRow, RadarAxis, StatBucket, StreakResultPayload, StreakResultRow, ThemeWeekHeatmap, TimedResultPayload, TimedResultRow } from '../types/history'
import { isCorrect } from '../components/ResultPage'
import { supabase } from './supabase'

function aggregate(questions: Question[], answers: AnswersByQuestion, keyOf: (question: Question) => string): Record<string, StatBucket> {
  const buckets: Record<string, StatBucket> = {}
  questions.forEach((question) => {
    const key = keyOf(question)
    const bucket = buckets[key] ?? { correct: 0, total: 0 }
    bucket.total += 1
    if (isCorrect(question, answers[question.id])) bucket.correct += 1
    buckets[key] = bucket
  })
  return buckets
}

/** Une ligne d'historique/classement représente le même quiz que `quizId`/`quizTitle` si son id correspond
 * (lien stable), ou si elle n'a pas d'id (partie d'avant cette colonne, ou quiz source depuis supprimé) et que
 * son titre figé correspond encore — permet de continuer à regrouper les anciennes lignes sans id. */
export function matchesQuiz(row: { quiz_id: string | null; quiz_title: string }, quizId: string | null, quizTitle: string): boolean {
  return row.quiz_id ? row.quiz_id === quizId : row.quiz_title === quizTitle
}

/** Construit le résumé d'une partie terminée, prêt à être enregistré. Les thèmes sont figés en libellés (pas des ids) pour rester lisibles même si le quiz importé change ensuite. */
export function buildQuizResultPayload(questions: Question[], answers: AnswersByQuestion, themes: Theme[], elapsedSeconds: number, quizTitle: string, quizId: string | null, unfiltered: boolean): QuizResultPayload {
  const correctQuestions = questions.filter((question) => isCorrect(question, answers[question.id]))
  const earnedPoints = correctQuestions.reduce((sum, question) => sum + question.points, 0)
  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0)
  const themeLabel = (id: string) => themes.find((theme) => theme.id === id)?.label ?? id

  return {
    quiz_title: quizTitle,
    quiz_id: quizId,
    score: totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0,
    earned_points: earnedPoints,
    total_points: totalPoints,
    elapsed_seconds: elapsedSeconds,
    question_count: questions.length,
    correct_count: correctQuestions.length,
    themes: Array.from(new Set(questions.map((question) => themeLabel(question.theme)))),
    by_theme: aggregate(questions, answers, (question) => themeLabel(question.theme)),
    by_type: aggregate(questions, answers, (question) => question.type),
    by_difficulty: aggregate(questions, answers, (question) => question.difficulty),
    unfiltered,
  }
}

/** Best-effort : une partie non enregistrée ne doit jamais empêcher l'utilisateur de voir son résultat. */
export async function saveQuizResult(payload: QuizResultPayload): Promise<void> {
  const { error } = await supabase.from('quiz_results').insert(payload)
  if (error) console.error("Impossible d'enregistrer le résultat du quiz.", error)
}

export async function fetchQuizHistory(): Promise<QuizResultRow[]> {
  const { data, error } = await supabase.from('quiz_results').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Une ligne par question de la partie, pour pouvoir repérer plus tard les questions ratées de façon récurrente. */
export function buildQuestionResultPayloads(questions: Question[], answers: AnswersByQuestion, quizTitle: string, quizId: string | null): QuestionResultPayload[] {
  return questions.map((question) => ({
    quiz_title: quizTitle,
    quiz_id: quizId,
    question_id: question.id,
    question_text: question.question,
    correct: isCorrect(question, answers[question.id]),
  }))
}

/** Best-effort, comme `saveQuizResult`. */
export async function saveQuestionResults(payloads: QuestionResultPayload[]): Promise<void> {
  if (!payloads.length) return
  const { error } = await supabase.from('question_results').insert(payloads)
  if (error) console.error("Impossible d'enregistrer le détail des réponses.", error)
}

export async function fetchQuestionResults(): Promise<QuestionResultRow[]> {
  const { data, error } = await supabase.from('question_results').select('*')
  if (error) throw error
  return data ?? []
}

/** Regroupe les résultats par question pour un quiz donné, ne garde que celles ratées au moins une fois, triées de la plus problématique à la moins. */
/** Une question reste "à retravailler" tant qu'elle n'est pas majoritairement réussie sur ses `RECENT_WINDOW`
 * tentatives les plus récentes — pas sur toute sa durée de vie, sinon une question ratée il y a longtemps mais
 * maîtrisée depuis resterait affichée indéfiniment (il faudrait autant de bonnes réponses que de mauvaises
 * accumulées pour repasser sous la barre). `wrongCount`/`attempts` restent cumulés sur toute la durée de vie
 * pour l'affichage ("ratée x fois sur y") — seul le critère d'inclusion dans la liste change. */
const RECENT_WINDOW = 5

export function computeMissedQuestions(rows: QuestionResultRow[], quizTitle: string, quizId: string | null): MissedQuestion[] {
  const byQuestion = new Map<string, QuestionResultRow[]>()
  rows.filter((row) => matchesQuiz(row, quizId, quizTitle)).forEach((row) => {
    const attempts = byQuestion.get(row.question_id) ?? []
    attempts.push(row)
    byQuestion.set(row.question_id, attempts)
  })
  return Array.from(byQuestion.values())
    .map((attempts) => {
      const chronological = [...attempts].sort((a, b) => a.created_at.localeCompare(b.created_at))
      const recent = chronological.slice(-RECENT_WINDOW)
      const recentCorrect = recent.filter((row) => row.correct).length
      const missed: MissedQuestion = {
        questionId: chronological[0].question_id,
        questionText: chronological[chronological.length - 1].question_text,
        attempts: chronological.length,
        wrongCount: chronological.filter((row) => !row.correct).length,
      }
      return { missed, recentlyMastered: recentCorrect * 2 > recent.length }
    })
    .filter(({ missed, recentlyMastered }) => missed.wrongCount > 0 && !recentlyMastered)
    .map(({ missed }) => missed)
    .sort((a, b) => b.wrongCount - a.wrongCount)
}

/** `rows` peut être dans n'importe quel ordre — seuls les agrégats comptent ici. */
export function computeRecords(rows: QuizResultRow[]): QuizRecords {
  if (!rows.length) return { gamesPlayed: 0, bestScore: 0, averageScore: 0, totalPlaytimeSeconds: 0 }
  return {
    gamesPlayed: rows.length,
    bestScore: Math.max(...rows.map((row) => row.score)),
    averageScore: Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length),
    totalPlaytimeSeconds: rows.reduce((sum, row) => sum + row.elapsed_seconds, 0),
  }
}

/** Cumule les buckets `correct`/`total` d'une clé (par ex. `by_theme`) sur l'ensemble de l'historique. */
export function sumBuckets(rows: QuizResultRow[], pick: (row: QuizResultRow) => Record<string, StatBucket>): Record<string, StatBucket> {
  const totals: Record<string, StatBucket> = {}
  rows.forEach((row) => {
    Object.entries(pick(row)).forEach(([key, bucket]) => {
      const total = totals[key] ?? { correct: 0, total: 0 }
      total.correct += bucket.correct
      total.total += bucket.total
      totals[key] = total
    })
  })
  return totals
}

/** Construit le résumé d'une partie "sans-faute" terminée, à partir des questions réellement jouées. */
export function buildStreakResultPayload(streakCount: number, elapsedSeconds: number, victory: boolean, playedQuestions: Question[], themes: Theme[], quizTitle: string, quizId: string | null, unfiltered: boolean): StreakResultPayload {
  const themeLabel = (id: string) => themes.find((theme) => theme.id === id)?.label ?? id
  return {
    quiz_title: quizTitle,
    quiz_id: quizId,
    streak_count: streakCount,
    elapsed_seconds: elapsedSeconds,
    victory,
    themes: Array.from(new Set(playedQuestions.map((question) => themeLabel(question.theme)))),
    unfiltered,
  }
}

/** Best-effort, comme `saveQuizResult`. */
export async function saveStreakResult(payload: StreakResultPayload): Promise<void> {
  const { error } = await supabase.from('streak_results').insert(payload)
  if (error) console.error("Impossible d'enregistrer le résultat du mode sans-faute.", error)
}

export async function fetchStreakHistory(): Promise<StreakResultRow[]> {
  const { data, error } = await supabase.from('streak_results').select('*')
    .order('streak_count', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Construit le résumé d'une partie "contre-la-montre" terminée, à partir des tentatives réellement jouées
 * (un tableau plutôt qu'un Record par question, car une même question peut revenir plusieurs fois). */
export function buildTimedResultPayload(attempts: QuestionAttempt[], elapsedSeconds: number, durationSeconds: number, themes: Theme[], quizTitle: string, quizId: string | null, unfiltered: boolean): TimedResultPayload {
  const themeLabel = (id: string) => themes.find((theme) => theme.id === id)?.label ?? id
  return {
    quiz_title: quizTitle,
    quiz_id: quizId,
    correct_count: attempts.filter((attempt) => isCorrect(attempt.question, attempt.answer)).length,
    question_count: attempts.length,
    duration_seconds: durationSeconds,
    elapsed_seconds: elapsedSeconds,
    themes: Array.from(new Set(attempts.map((attempt) => themeLabel(attempt.question.theme)))),
    unfiltered,
  }
}

/** Best-effort, comme `saveQuizResult`. */
export async function saveTimedResult(payload: TimedResultPayload): Promise<void> {
  const { error } = await supabase.from('timed_results').insert(payload)
  if (error) console.error("Impossible d'enregistrer le résultat du mode contre-la-montre.", error)
}

export async function fetchTimedHistory(): Promise<TimedResultRow[]> {
  const { data, error } = await supabase.from('timed_results').select('*')
    .order('correct_count', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Admin uniquement (RLS) : supprime tout l'historique (toutes les parties, tous joueurs confondus) d'un
 * quiz, identifié par son titre — utilisé quand un admin choisit de purger l'historique en supprimant un
 * quiz hébergé. Volontairement pas de cascade automatique depuis `quizzes` : l'historique reste par défaut
 * après une suppression de quiz (cf. `deleteQuiz`), ceci n'est qu'une purge explicite optionnelle. */
export async function deleteQuizHistory(quizTitle: string): Promise<void> {
  const tables = ['quiz_results', 'question_results', 'streak_results', 'timed_results'] as const
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('quiz_title', quizTitle)
    if (error) throw error
  }
}

/** Convertit des buckets cumulés en axes de radar (taux de réussite, %), limité aux `maxAxes` catégories les
 * plus jouées — au-delà d'une dizaine d'axes un radar devient illisible (cas des quiz à 20+ thèmes). */
export function bucketsToRadarAxes(buckets: Record<string, StatBucket>, labelOf: (key: string) => string, maxAxes = 8): RadarAxis[] {
  return Object.entries(buckets)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, maxAxes)
    .map(([key, bucket]) => ({ key, label: labelOf(key), value: bucket.total ? Math.round((bucket.correct / bucket.total) * 100) : 0 }))
}

/** Lundi (heure locale) de la semaine contenant `date`, au format `YYYY-MM-DD` — clé de regroupement hebdomadaire. */
export function weekStartKey(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

/** Croise thèmes (lignes) et semaines (colonnes) : pour chaque case, le cumul correct/total des parties de cette
 * semaine, `null` si le thème n'a pas été joué. Seules les `maxWeeks` dernières semaines comportant au moins une
 * partie sont gardées (pas de colonnes vides), et les `maxThemes` thèmes les plus joués — au-delà, la grille
 * devient illisible sur les quiz à beaucoup de thèmes. */
export function computeThemeWeekHeatmap(rows: QuizResultRow[], maxWeeks = 12, maxThemes = 15): ThemeWeekHeatmap {
  const weekKeys = Array.from(new Set(rows.map((row) => weekStartKey(new Date(row.created_at))))).sort().slice(-maxWeeks)
  const byTheme = new Map<string, Map<string, StatBucket>>()
  rows.forEach((row) => {
    const week = weekStartKey(new Date(row.created_at))
    if (!weekKeys.includes(week)) return
    Object.entries(row.by_theme).forEach(([theme, bucket]) => {
      const weeks = byTheme.get(theme) ?? new Map<string, StatBucket>()
      const cell = weeks.get(week) ?? { correct: 0, total: 0 }
      cell.correct += bucket.correct
      cell.total += bucket.total
      weeks.set(week, cell)
      byTheme.set(theme, weeks)
    })
  })
  const totalOf = (weeks: Map<string, StatBucket>) => Array.from(weeks.values()).reduce((sum, cell) => sum + cell.total, 0)
  const allThemes = Array.from(byTheme.entries()).sort(([, a], [, b]) => totalOf(b) - totalOf(a))
  return {
    weeks: weekKeys,
    themes: allThemes.slice(0, maxThemes).map(([label, weeks]) => ({ label, cells: weekKeys.map((week) => weeks.get(week) ?? null) })),
    truncated: allThemes.length > maxThemes,
  }
}

/** Convertit des buckets cumulés en groupes prêts pour `PieChart`. */
export function bucketsToChartGroups(buckets: Record<string, StatBucket>, labelOf: (key: string) => string, succeededLabel = 'Réussi', missedLabel = 'Raté'): ChartGroup[] {
  return Object.entries(buckets).map(([key, bucket]) => ({
    key,
    label: labelOf(key),
    data: [
      { label: succeededLabel, value: bucket.correct, color: '#34d399' },
      { label: missedLabel, value: bucket.total - bucket.correct, color: '#fb7185' },
    ].filter((slice) => slice.value > 0),
  }))
}
