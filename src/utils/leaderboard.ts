import type { LeaderboardRow } from '../types/leaderboard'
import { supabase } from './supabase'

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.from('leaderboard').select('*').order('best_score', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Le meilleur score tous joueurs confondus pour un quiz donné, pour l'affichage sur la page d'accueil. */
export async function fetchTopScore(quizTitle: string): Promise<LeaderboardRow | null> {
  const { data, error } = await supabase.from('leaderboard').select('*').eq('quiz_title', quizTitle).order('best_score', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data
}
