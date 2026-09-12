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
