import type { AnswersByQuestion, Question, Theme } from '../types/quiz'
import type { ChartGroup, QuizRecords, QuizResultPayload, QuizResultRow, StatBucket } from '../types/history'
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
export function buildQuizResultPayload(questions: Question[], answers: AnswersByQuestion, themes: Theme[], elapsedSeconds: number, quizTitle: string): QuizResultPayload {
  const earnedPoints = questions.filter((question) => isCorrect(question, answers[question.id])).reduce((sum, question) => sum + question.points, 0)
  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0)
  const themeLabel = (id: string) => themes.find((theme) => theme.id === id)?.label ?? id

  return {
    quiz_title: quizTitle,
    score: totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0,
    earned_points: earnedPoints,
    total_points: totalPoints,
    elapsed_seconds: elapsedSeconds,
    question_count: questions.length,
    themes: Array.from(new Set(questions.map((question) => themeLabel(question.theme)))),
    by_theme: aggregate(questions, answers, (question) => themeLabel(question.theme)),
    by_type: aggregate(questions, answers, (question) => question.type),
    by_difficulty: aggregate(questions, answers, (question) => question.difficulty),
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
