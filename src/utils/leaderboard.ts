import type { LeaderboardRow, OverallLeaderboardRow, StreakLeaderboardRow, TimedLeaderboardRow } from '../types/leaderboard'
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

export async function fetchStreakLeaderboard(): Promise<StreakLeaderboardRow[]> {
  const { data, error } = await supabase.from('streak_leaderboard').select('*')
    .order('best_streak', { ascending: false }).order('victory', { ascending: false }).order('elapsed_seconds', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchTimedLeaderboard(): Promise<TimedLeaderboardRow[]> {
  // NULLS LAST : une partie de 0 seconde (pace non calculable) ne doit pas se retrouver en tête faute de valeur.
  const { data, error } = await supabase.from('timed_leaderboard').select('*')
    .order('pace_per_minute', { ascending: false, nullsFirst: false }).order('correct_count', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Cumulé sur toutes les parties non filtrées, tous modes confondus — trié sur le volume de bonnes
 * réponses en premier (pas le taux de réussite, sinon quelques parties parfaites battraient un gros
 * volume de bonnes réponses à un excellent taux). */
export async function fetchOverallLeaderboard(): Promise<OverallLeaderboardRow[]> {
  const { data, error } = await supabase.from('overall_leaderboard').select('*')
    .order('total_correct', { ascending: false }).order('success_rate', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data ?? []
}
