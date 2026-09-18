export interface StatBucket {
  correct: number
  total: number
}

export interface QuizResultPayload {
  quiz_title: string
  /** Lien stable vers `quizzes.id` — permet de retrouver l'historique d'un quiz même après renommage. `null`
   * pour les parties jouées avant l'introduction de ce champ ou dont le quiz source a depuis été supprimé. */
  quiz_id: string | null
  score: number
  earned_points: number
  total_points: number
  elapsed_seconds: number
  question_count: number
  /** Nombre de questions correctement répondues (pas les points — les points varient par difficulté). Alimente le classement général cumulé. */
  correct_count: number
  themes: string[]
  by_theme: Record<string, StatBucket>
  by_type: Record<string, StatBucket>
  by_difficulty: Record<string, StatBucket>
  /** Aucun filtre thème/difficulté appliqué — seules ces parties comptent pour le classement (voir les vues *_leaderboard). */
  unfiltered: boolean
}

export interface QuizResultRow extends QuizResultPayload {
  id: string
  created_at: string
}

export interface QuizRecords {
  gamesPlayed: number
  bestScore: number
  averageScore: number
  totalPlaytimeSeconds: number
}

export interface ChartGroup {
  key: string
  label: string
  data: { label: string; value: number; color: string }[]
}

export interface RadarAxis {
  key: string
  label: string
  /** Taux de réussite, en pourcentage (0-100). */
  value: number
}

export interface ThemeWeekHeatmap {
  /** Débuts de semaine (lundi, `YYYY-MM-DD`), du plus ancien au plus récent. */
  weeks: string[]
  /** Une ligne par thème ; `cells[i]` correspond à `weeks[i]`, `null` si le thème n'a pas été joué cette semaine-là. */
  themes: { label: string; cells: (StatBucket | null)[] }[]
  truncated: boolean
}

export interface QuestionResultPayload {
  quiz_title: string
  quiz_id: string | null
  question_id: string
  question_text: string
  correct: boolean
}

export interface QuestionResultRow extends QuestionResultPayload {
  id: string
  created_at: string
}

export interface MissedQuestion {
  questionId: string
  questionText: string
  attempts: number
  wrongCount: number
}

export interface StreakResultPayload {
  quiz_title: string
  quiz_id: string | null
  streak_count: number
  elapsed_seconds: number
  victory: boolean
  themes: string[]
  /** Aucun filtre thème/difficulté appliqué — seules ces parties comptent pour le classement. */
  unfiltered: boolean
}

export interface StreakResultRow extends StreakResultPayload {
  id: string
  created_at: string
}

export interface TimedResultPayload {
  quiz_title: string
  quiz_id: string | null
  correct_count: number
  question_count: number
  /** 0 = mode "Infini" (pas de limite). */
  duration_seconds: number
  elapsed_seconds: number
  themes: string[]
  /** Aucun filtre thème/difficulté appliqué — seules ces parties comptent pour le classement. */
  unfiltered: boolean
}

export interface TimedResultRow extends TimedResultPayload {
  id: string
  created_at: string
}
