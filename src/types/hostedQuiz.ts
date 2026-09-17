export interface HostedQuizSummary {
  id: string
  title: string
  is_public: boolean
}

export interface HostedQuizRow extends HostedQuizSummary {
  content: unknown
  created_by: string | null
  created_at: string
  updated_at: string
}
