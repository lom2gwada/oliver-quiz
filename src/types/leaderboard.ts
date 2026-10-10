export interface LeaderboardRow {
  quiz_title: string
  quiz_id: string | null
  user_id: string
  pseudo: string
  avatar: string
  best_score: number
  earned_points: number
  total_points: number
  elapsed_seconds: number
  question_count: number
  correct_count: number
  pace_per_minute: number | null
  /** Date de la partie retenue pour ce joueur. */
  played_at: string
}

export interface StreakLeaderboardRow {
  quiz_title: string
  quiz_id: string | null
  user_id: string
  pseudo: string
  avatar: string
  best_streak: number
  victory: boolean
  elapsed_seconds: number
  themes: string[]
  pace_per_minute: number | null
  /** `null` pour les parties jouées avant l'introduction de ces champs. */
  earned_points: number | null
  total_points: number | null
  played_at: string
}

export interface TimedLeaderboardRow {
  quiz_title: string
  quiz_id: string | null
  user_id: string
  pseudo: string
  avatar: string
  correct_count: number
  question_count: number
  duration_seconds: number
  elapsed_seconds: number
  pace_per_minute: number | null
  themes: string[]
  /** `null` pour les parties jouées avant l'introduction de ces champs. */
  earned_points: number | null
  total_points: number | null
  played_at: string
}

/** Cumulé sur toutes les parties (non filtrées) tous modes confondus, contrairement aux 3 autres
 * classements qui ne gardent que la meilleure partie de chacun. */
export interface OverallLeaderboardRow {
  quiz_title: string
  quiz_id: string | null
  user_id: string
  pseudo: string
  avatar: string
  total_correct: number
  total_attempted: number
  success_rate: number | null
  games_played: number
  total_earned_points: number
  /** Date de la dernière partie du joueur (le classement Général cumule toutes ses parties). */
  last_played_at: string
}
