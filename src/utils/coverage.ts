import type { QuizImage } from '../types/quiz'
import { isHttpsUrl } from './quizMeta'
import { retryWithBackoff } from './retry'
import { supabase } from './supabase'

/** Une ligne de `my_quiz_coverage()` (voir `028_quiz_coverage.sql`). */
export interface QuizCoverage {
  quiz_id: string
  quiz_title: string
  question_count: number
  seen_count: number
  games_played: number
  last_played_at: string | null
  /** Cartes Leitner échues dont la question existe encore : ce que « Réviser » proposera. */
  due_count: number
  /** `metadata.description` / `metadata.language` du quiz, `null` s'ils ne sont pas précisés (présentation dans « À découvrir »). */
  description: string | null
  language: string | null
  /** `metadata.image` du quiz (`null` sans image) ; absents tant que la migration 032 n'est pas appliquée. */
  image_url?: string | null
  image_alt?: string | null
}

/** Couverture à afficher pour cette ligne : seule une URL `https://` est reprise (la ligne vient de la base, pas de `parseQuiz`). */
export function coverageImage(row: Pick<QuizCoverage, 'image_url' | 'image_alt'>): QuizImage | undefined {
  return row.image_url && isHttpsUrl(row.image_url) ? { url: row.image_url, alt: row.image_alt ?? '' } : undefined
}

/** Taille d'une session de révision lancée depuis « Mes quiz » (les plus fragiles d'abord) — la page
 * d'historique propose, elle, de choisir cette taille. */
export const REVIEW_BATCH_SIZE = 20

export async function fetchQuizCoverage(): Promise<QuizCoverage[]> {
  return retryWithBackoff(async () => {
    const { data, error } = await supabase.rpc('my_quiz_coverage')
    if (error) throw error
    return (data ?? []) as QuizCoverage[]
  }, { delaysMs: [600, 1800] })
}

/** Arrondi à l'entier inférieur : 99,6 % ne doit pas s'afficher « 100 % » tant qu'il reste une question à voir. */
export function coveragePercent(seen: number, total: number): number {
  return total > 0 ? Math.floor((Math.min(seen, total) / total) * 100) : 0
}

/** Part du quiz découverte au dixième inférieur (93,2) : sert à l'affichage — un quiz de plus de mille questions
 * progresse de quelques dixièmes par partie — et ne dépasse « 100 » que si tout a été vu. */
export function coveragePercentTenths(seen: number, total: number): number {
  return total > 0 ? Math.floor((Math.min(seen, total) * 1000) / total) / 10 : 0
}

/** Un quiz est « commencé » dès qu'une partie a été jouée dessus (tous modes), même si seul le mode sans-faute
 * ou contre-la-montre — qui ne journalisent pas les questions — a été utilisé. */
export const isStarted = (row: QuizCoverage) => row.games_played > 0 || row.seen_count > 0

/** Quiz commencés (le plus récemment joué d'abord), puis quiz jamais joués (ordre alphabétique conservé). */
export function splitCoverage(rows: QuizCoverage[]): { started: QuizCoverage[]; untouched: QuizCoverage[] } {
  const started = rows.filter(isStarted).sort((a, b) => (b.last_played_at ?? '').localeCompare(a.last_played_at ?? ''))
  const untouched = rows.filter((row) => !isStarted(row)).sort((a, b) => a.quiz_title.localeCompare(b.quiz_title))
  return { started, untouched }
}

export function coverageTotals(started: QuizCoverage[]): { seen: number; total: number; percent: number } {
  const seen = started.reduce((sum, row) => sum + Math.min(row.seen_count, row.question_count), 0)
  const total = started.reduce((sum, row) => sum + row.question_count, 0)
  return { seen, total, percent: coveragePercentTenths(seen, total) }
}
