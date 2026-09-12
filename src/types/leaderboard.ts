export interface LeaderboardRow {
  quiz_title: string
  user_id: string
  pseudo: string
  avatar: string
  best_score: number
  earned_points: number
  total_points: number
  elapsed_seconds: number
  question_count: number
}

export interface StreakLeaderboardRow {
  quiz_title: string
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
