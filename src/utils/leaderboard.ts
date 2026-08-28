import type { LeaderboardRow } from '../types/leaderboard'
import { supabase } from './supabase'

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  // À score égal, on départage par points gagnés (récompense les parties plus longues/difficiles) puis par rapidité.
  const { data, error } = await supabase.from('leaderboard').select('*')
    .order('best_score', { ascending: false }).order('earned_points', { ascending: false }).order('elapsed_seconds', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Le meilleur score tous joueurs confondus pour un quiz donné, pour l'affichage sur la page d'accueil. */
export async function fetchTopScore(quizTitle: string): Promise<LeaderboardRow | null> {
  const { data, error } = await supabase.from('leaderboard').select('*').eq('quiz_title', quizTitle)
    .order('best_score', { ascending: false }).order('earned_points', { ascending: false }).order('elapsed_seconds', { ascending: true })
    .limit(1).maybeSingle()
  if (error) throw error
  return data
}
