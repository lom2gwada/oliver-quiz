export interface StatBucket {
  correct: number
  total: number
}

export interface QuizResultPayload {
  quiz_title: string
  score: number
  earned_points: number
  total_points: number
  elapsed_seconds: number
  question_count: number
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

export interface QuestionResultPayload {
  quiz_title: string
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
