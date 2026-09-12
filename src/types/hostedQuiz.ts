export interface HostedQuizSummary {
  id: string
  title: string
}

export interface HostedQuizRow extends HostedQuizSummary {
  content: unknown
  created_by: string | null
  created_at: string
  updated_at: string
}
