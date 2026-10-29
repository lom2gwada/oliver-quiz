import type { AnswersByQuestion, Question, QuestionAttempt, Category, GameMode } from '../types/quiz'
import type { ChartGroup, GameQuestionRow, QuestionResultPayload, QuizRecords, QuizResultPayload, QuizResultRow, RadarAxis, StatBucket, StreakResultPayload, StreakResultRow, ThemeWeekHeatmap, TimedResultPayload, TimedResultRow } from '../types/history'
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

/** Construit le résumé d'une partie terminée, prêt à être enregistré. Les thèmes sont figés en libellés (pas des ids) pour rester lisibles même si le quiz importé change ensuite. */
export function buildQuizResultPayload(questions: Question[], answers: AnswersByQuestion, themes: Category[], elapsedSeconds: number, quizTitle: string, quizId: string | null, unfiltered: boolean): QuizResultPayload {
  const correctQuestions = questions.filter((question) => isCorrect(question, answers[question.id]))
  const earnedPoints = correctQuestions.reduce((sum, question) => sum + question.points, 0)
  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0)
  const themeLabel = (id: string) => themes.find((theme) => theme.id === id)?.label ?? id

  return {
    id: crypto.randomUUID(),
    quiz_title: quizTitle,
    quiz_id: quizId,
    score: totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0,
    earned_points: earnedPoints,
    total_points: totalPoints,
    elapsed_seconds: elapsedSeconds,
    question_count: questions.length,
    correct_count: correctQuestions.length,
    themes: Array.from(new Set(questions.map((question) => themeLabel(question.category)))),
    by_theme: aggregate(questions, answers, (question) => themeLabel(question.category)),
    by_type: aggregate(questions, answers, (question) => question.type),
    by_difficulty: aggregate(questions, answers, (question) => question.difficulty),
    unfiltered,
  }
}

/** Insère des lignes dont l'`id` est fourni par le client : rejouer l'écriture (reprise automatique, ou bouton
 * « Réessayer » après une réponse perdue alors que la ligne était bien arrivée) ne crée jamais de doublon. Lève l'erreur
 * au lieu de l'avaler : c'est l'appelant (`runSaveJobs`) qui relance, puis prévient le joueur si rien n'y fait. */
async function insertOnce(table: 'quiz_results' | 'question_results' | 'streak_results' | 'timed_results', rows: object | object[]): Promise<void> {
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw error
}

/** L'enregistrement n'empêche jamais d'afficher le résultat : il se fait en arrière-plan, et un échec final est
 * signalé sur l'écran de résultat (voir `SaveStatusNotice`). */
export async function saveQuizResult(payload: QuizResultPayload): Promise<void> {
  await insertOnce('quiz_results', payload)
}

export async function fetchQuizHistory(): Promise<QuizResultRow[]> {
  const { data, error } = await supabase.from('quiz_results').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Une ligne par question de la partie : journal brut, conservé même si la sélection des questions à réviser
 * repose désormais sur `question_progress` (boîtes de Leitner, voir `utils/leitner.ts`) plutôt que sur ce log. */
export function buildQuestionResultPayloads(questions: Question[], answers: AnswersByQuestion, quizTitle: string, quizId: string | null, gameId: string | null = null, mode: GameMode = 'classic'): QuestionResultPayload[] {
  return buildAttemptResultPayloads(questions.map((question) => ({ question, answer: answers[question.id] })), quizTitle, quizId, gameId, mode)
}

/** Même journal pour une partie dont les questions peuvent revenir (contre-la-montre) : une ligne par tentative, dans l'ordre. */
export function buildAttemptResultPayloads(attempts: QuestionAttempt[], quizTitle: string, quizId: string | null, gameId: string | null, mode: GameMode): QuestionResultPayload[] {
  return attempts.map(({ question, answer }, index) => ({
    id: crypto.randomUUID(),
    quiz_title: quizTitle,
    quiz_id: quizId,
    question_id: question.id,
    question_text: question.question,
    correct: isCorrect(question, answer),
    game_mode: mode,
    game_id: gameId,
    position: index,
    answer: answer ?? null,
  }))
}

/** Les questions d'une partie (de n'importe quel mode), dans l'ordre où elles ont été posées. Vide pour une partie d'avant
 * `035_question_results_game_detail.sql` (classique) ou `040_question_results_any_mode.sql` (sans-faute, contre-la-montre) :
 * son détail se limite alors aux totaux déjà stockés sur la partie. Lit aussi `quiz_result_id`, que l'ancienne version de
 * l'appli (onglet resté ouvert) écrit encore ; un identifiant de partie est un UUID, il ne peut pas désigner deux parties. */
export async function fetchGameQuestions(gameId: string): Promise<GameQuestionRow[]> {
  const { data, error } = await supabase.from('question_results').select('question_id, question_text, correct, position, answer').or(`game_id.eq.${gameId},quiz_result_id.eq.${gameId}`).order('position', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function saveQuestionResults(payloads: QuestionResultPayload[]): Promise<void> {
  if (!payloads.length) return
  await insertOnce('question_results', payloads)
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

/** Construit le résumé d'une partie "sans-faute" terminée, à partir des questions réellement jouées. Seule la
 * dernière question de `playedQuestions` peut être une erreur (celle qui a stoppé la série, sauf victoire) —
 * inutile de connaître le détail des réponses pour calculer les points gagnés. */
export function buildStreakResultPayload(streakCount: number, elapsedSeconds: number, victory: boolean, playedQuestions: Question[], themes: Category[], quizTitle: string, quizId: string | null, unfiltered: boolean): StreakResultPayload {
  const themeLabel = (id: string) => themes.find((theme) => theme.id === id)?.label ?? id
  const totalPoints = playedQuestions.reduce((sum, question) => sum + question.points, 0)
  const missedPoints = victory || !playedQuestions.length ? 0 : playedQuestions[playedQuestions.length - 1].points
  return {
    id: crypto.randomUUID(),
    quiz_title: quizTitle,
    quiz_id: quizId,
    streak_count: streakCount,
    elapsed_seconds: elapsedSeconds,
    victory,
    themes: Array.from(new Set(playedQuestions.map((question) => themeLabel(question.category)))),
    earned_points: totalPoints - missedPoints,
    total_points: totalPoints,
    unfiltered,
  }
}

export async function saveStreakResult(payload: StreakResultPayload): Promise<void> {
  await insertOnce('streak_results', payload)
}

export async function fetchStreakHistory(): Promise<StreakResultRow[]> {
  const { data, error } = await supabase.from('streak_results').select('*')
    .order('streak_count', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Construit le résumé d'une partie "contre-la-montre" terminée, à partir des tentatives réellement jouées
 * (un tableau plutôt qu'un Record par question, car une même question peut revenir plusieurs fois). */
export function buildTimedResultPayload(attempts: QuestionAttempt[], elapsedSeconds: number, durationSeconds: number, themes: Category[], quizTitle: string, quizId: string | null, unfiltered: boolean): TimedResultPayload {
  const themeLabel = (id: string) => themes.find((theme) => theme.id === id)?.label ?? id
  const correctAttempts = attempts.filter((attempt) => isCorrect(attempt.question, attempt.answer))
  return {
    id: crypto.randomUUID(),
    quiz_title: quizTitle,
    quiz_id: quizId,
    correct_count: correctAttempts.length,
    question_count: attempts.length,
    duration_seconds: durationSeconds,
    elapsed_seconds: elapsedSeconds,
    themes: Array.from(new Set(attempts.map((attempt) => themeLabel(attempt.question.category)))),
    earned_points: correctAttempts.reduce((sum, attempt) => sum + attempt.question.points, 0),
    total_points: attempts.reduce((sum, attempt) => sum + attempt.question.points, 0),
    unfiltered,
  }
}

export async function saveTimedResult(payload: TimedResultPayload): Promise<void> {
  await insertOnce('timed_results', payload)
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

/** Les lundis de toutes les semaines entre deux clés `YYYY-MM-DD` de lundi, bornes comprises, du plus ancien au plus récent. */
export function weekKeysBetween(first: string, last: string): string[] {
  const keys: string[] = []
  const [year, month, day] = first.split('-').map(Number)
  for (let offset = 0; ; offset += 7) {
    const key = weekStartKey(new Date(year, month - 1, day + offset))
    if (key > last) return keys
    keys.push(key)
  }
}

/** Croise thèmes (lignes) et semaines (colonnes) : pour chaque case, le cumul correct/total des parties de cette
 * semaine, `null` si le thème n'a pas été joué. Les colonnes sont toutes les semaines de la période — de la première
 * à la dernière partie, semaines sans partie comprises (les sauter faisait paraître consécutives deux semaines
 * éloignées) — limitées aux `maxWeeks` dernières, et les lignes aux `maxThemes` thèmes les plus joués : au-delà, la
 * grille devient illisible sur les quiz à beaucoup de thèmes. */
export function computeThemeWeekHeatmap(rows: QuizResultRow[], maxWeeks = 12, maxThemes = 15): ThemeWeekHeatmap {
  const playedWeeks = Array.from(new Set(rows.map((row) => weekStartKey(new Date(row.created_at))))).sort()
  const weekKeys = playedWeeks.length ? weekKeysBetween(playedWeeks[0], playedWeeks[playedWeeks.length - 1]).slice(-maxWeeks) : []
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
