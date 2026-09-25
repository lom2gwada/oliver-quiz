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
}
