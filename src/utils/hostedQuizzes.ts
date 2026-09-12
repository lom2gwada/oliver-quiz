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
