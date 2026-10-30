import { coveragePercentTenths } from './coverage'
import { retryWithBackoff } from './retry'
import { supabase } from './supabase'

/** Une ligne de `my_theme_progress()` (voir `043_my_theme_progress.sql`). */
export interface ThemeProgress {
  theme_id: string
  theme_label: string
  question_count: number
  seen_count: number
  mastered_count: number
  attempts: number
  correct_attempts: number
}

/** Un identifiant de quiz hébergé (les lignes d'historique plus anciennes n'ont que le titre du quiz). */
export const isHostedQuizId = (key: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)

export async function fetchThemeProgress(quizId: string): Promise<ThemeProgress[]> {
  return retryWithBackoff(async () => {
    const { data, error } = await supabase.rpc('my_theme_progress', { p_quiz_id: quizId })
    if (error) throw error
    return (data ?? []) as ThemeProgress[]
  }, { delaysMs: [600, 1800] })
}

export interface ThemeProgressView extends ThemeProgress {
  /** Part des questions du thème déjà vues, au dixième inférieur (comme « Mes quiz »). */
  seenPercent: number
  masteredPercent: number
  /** Taux de réussite de toutes les réponses données (0-100, arrondi) ; `null` tant que le thème n'a jamais été joué. */
  successRate: number | null
}

export function toThemeProgressView(row: ThemeProgress): ThemeProgressView {
  return {
    ...row,
    seenPercent: coveragePercentTenths(row.seen_count, row.question_count),
    masteredPercent: coveragePercentTenths(row.mastered_count, row.question_count),
    successRate: row.attempts > 0 ? Math.round((row.correct_attempts / row.attempts) * 100) : null,
  }
}

/** Les thèmes vides (aucune question) n'ont rien à montrer ; l'ordre est celui de la liste « themes » du quiz. */
export const themeProgressViews = (rows: ThemeProgress[]): ThemeProgressView[] => rows.filter((row) => row.question_count > 0).map(toThemeProgressView)
