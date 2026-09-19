export type GuestLinkMode = 'test' | 'survey'

export interface GuestLink {
  token: string
  quiz_id: string
  mode: GuestLinkMode
  label: string | null
  created_at: string
}
