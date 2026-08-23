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
