export interface StatBucket {
  correct: number
  total: number
}

export interface QuizResultPayload {
  score: number
  earned_points: number
  total_points: number
  elapsed_seconds: number
  question_count: number
  themes: string[]
  by_theme: Record<string, StatBucket>
  by_type: Record<string, StatBucket>
  by_difficulty: Record<string, StatBucket>
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
