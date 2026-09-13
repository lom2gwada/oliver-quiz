import type { AnswersByQuestion, Question, QuestionAttempt, Theme } from '../types/quiz'
import type { ChartGroup, MissedQuestion, QuestionResultPayload, QuestionResultRow, QuizRecords, QuizResultPayload, QuizResultRow, RadarAxis, StatBucket, StreakResultPayload, StreakResultRow, TimedResultPayload, TimedResultRow } from '../types/history'
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
export function buildQuizResultPayload(questions: Question[], answers: AnswersByQuestion, themes: Theme[], elapsedSeconds: number, quizTitle: string, unfiltered: boolean): QuizResultPayload {
  const correctQuestions = questions.filter((question) => isCorrect(question, answers[question.id]))
  const earnedPoints = correctQuestions.reduce((sum, question) => sum + question.points, 0)
  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0)
  const themeLabel = (id: string) => themes.find((theme) => theme.id === id)?.label ?? id

  return {
    quiz_title: quizTitle,
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
export function buildQuestionResultPayloads(questions: Question[], answers: AnswersByQuestion, quizTitle: string): QuestionResultPayload[] {
  return questions.map((question) => ({
    quiz_title: quizTitle,
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
export function computeMissedQuestions(rows: QuestionResultRow[], quizTitle: string): MissedQuestion[] {
  const byQuestion = new Map<string, MissedQuestion>()
  rows.filter((row) => row.quiz_title === quizTitle).forEach((row) => {
    const entry = byQuestion.get(row.question_id) ?? { questionId: row.question_id, questionText: row.question_text, attempts: 0, wrongCount: 0 }
    entry.attempts += 1
    if (!row.correct) entry.wrongCount += 1
    entry.questionText = row.question_text
    byQuestion.set(row.question_id, entry)
  })
  return Array.from(byQuestion.values()).filter((entry) => entry.wrongCount > 0).sort((a, b) => b.wrongCount - a.wrongCount)
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
export function buildStreakResultPayload(streakCount: number, elapsedSeconds: number, victory: boolean, playedQuestions: Question[], themes: Theme[], quizTitle: string, unfiltered: boolean): StreakResultPayload {
  const themeLabel = (id: string) => themes.find((theme) => theme.id === id)?.label ?? id
  return {
    quiz_title: quizTitle,
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
export function buildTimedResultPayload(attempts: QuestionAttempt[], elapsedSeconds: number, durationSeconds: number, themes: Theme[], quizTitle: string, unfiltered: boolean): TimedResultPayload {
  const themeLabel = (id: string) => themes.find((theme) => theme.id === id)?.label ?? id
  return {
    quiz_title: quizTitle,
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

/** Convertit des buckets cumulés en axes de radar (taux de réussite, %), limité aux `maxAxes` catégories les
 * plus jouées — au-delà d'une dizaine d'axes un radar devient illisible (cas des quiz à 20+ thèmes). */
export function bucketsToRadarAxes(buckets: Record<string, StatBucket>, labelOf: (key: string) => string, maxAxes = 8): RadarAxis[] {
  return Object.entries(buckets)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, maxAxes)
    .map(([key, bucket]) => ({ key, label: labelOf(key), value: bucket.total ? Math.round((bucket.correct / bucket.total) * 100) : 0 }))
}

/** Convertit des buckets cumulés en groupes prêts pour `PieChart`. */
export function bucketsToChartGroups(buckets: Record<string, StatBucket>, labelOf: (key: string) => string): ChartGroup[] {
  return Object.entries(buckets).map(([key, bucket]) => ({
    key,
    label: labelOf(key),
    data: [
      { label: 'Réussi', value: bucket.correct, color: '#34d399' },
      { label: 'Raté', value: bucket.total - bucket.correct, color: '#fb7185' },
    ].filter((slice) => slice.value > 0),
  }))
}
