import type { HostedQuizSummary } from '../types/hostedQuiz'
import { supabase } from './supabase'

/** Les quiz hébergés auxquels l'utilisateur courant a accès (RLS filtre déjà — un admin les voit tous). */
export async function fetchAccessibleQuizzes(): Promise<HostedQuizSummary[]> {
  const { data, error } = await supabase.from('quizzes').select('id, title').order('title')
  if (error) throw error
  return data ?? []
}

/** Le contenu brut (non validé) d'un quiz hébergé — à faire passer par `parseQuiz` côté appelant, comme un fichier importé. */
export async function fetchQuizContent(id: string): Promise<unknown> {
  const { data, error } = await supabase.from('quizzes').select('content').eq('id', id).single()
  if (error) throw error
  return data.content
}

/** Admin uniquement (RLS) : crée le quiz s'il n'existe pas, met à jour son contenu sinon (par `title`).
 * N'accorde jamais d'accès automatiquement — c'est à l'admin de le faire ensuite, question par question. */
export async function upsertQuiz(title: string, content: unknown): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase.from('quizzes').upsert(
    { title, content, created_by: userData.user?.id, updated_at: new Date().toISOString() },
    { onConflict: 'title' },
  )
  if (error) throw error
}

export interface ProfileSummary {
  id: string
  pseudo: string
  avatar: string
}

/** Admin uniquement (RLS) : tout le monde, pour choisir à qui accorder l'accès à un quiz. */
export async function fetchAllProfiles(): Promise<ProfileSummary[]> {
  const { data, error } = await supabase.from('profiles').select('id, pseudo, avatar').order('pseudo')
  if (error) throw error
  return data ?? []
}

/** Admin uniquement (RLS) : les utilisateurs ayant déjà accès à ce quiz. */
export async function fetchAccessGrants(quizId: string): Promise<string[]> {
  const { data, error } = await supabase.from('quiz_access').select('user_id').eq('quiz_id', quizId)
  if (error) throw error
  return (data ?? []).map((row) => row.user_id)
}

export async function grantAccess(quizId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('quiz_access').insert({ quiz_id: quizId, user_id: userId })
  if (error) throw error
}

export async function revokeAccess(quizId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('quiz_access').delete().eq('quiz_id', quizId).eq('user_id', userId)
  if (error) throw error
}
