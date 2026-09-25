import type { LeaderboardRow, OverallLeaderboardRow, StreakLeaderboardRow, TimedLeaderboardRow } from '../types/leaderboard'
import { supabase } from './supabase'

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  // Le nombre de bonnes réponses domine (récompense le volume plutôt que le seul taux de réussite d'une
  // partie courte parfaite) ; à égalité, le pourcentage puis les points puis la rapidité départagent.
  const { data, error } = await supabase.from('leaderboard').select('*')
    .order('correct_count', { ascending: false }).order('best_score', { ascending: false }).order('earned_points', { ascending: false }).order('elapsed_seconds', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Le meilleur score tous joueurs confondus pour un quiz donné, pour l'affichage sur la page d'accueil —
 * même critère de tri que le classement (nombre de bonnes réponses en premier). Filtre par `quiz_id` quand
 * disponible (lien stable, insensible à un renommage) — repli sur le titre seulement le temps du tout premier
 * affichage, avant que le quiz actif n'ait un id connu. */
export async function fetchTopScore(quizTitle: string, quizId: string | null): Promise<LeaderboardRow | null> {
  const query = quizId ? supabase.from('leaderboard').select('*').eq('quiz_id', quizId) : supabase.from('leaderboard').select('*').eq('quiz_title', quizTitle)
  const { data, error } = await query
    .order('correct_count', { ascending: false }).order('best_score', { ascending: false }).order('earned_points', { ascending: false }).order('elapsed_seconds', { ascending: true })
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
  // Le volume de bonnes réponses prime (même raisonnement que le classement classique) : sinon une partie de
  // quelques secondes à haut rythme battrait une vraie partie bien plus remplie. NULLS LAST sur le rythme :
  // une partie de 0 seconde (pace non calculable) ne doit pas se retrouver en tête faute de valeur.
  const { data, error } = await supabase.from('timed_leaderboard').select('*')
    .order('correct_count', { ascending: false }).order('pace_per_minute', { ascending: false, nullsFirst: false })
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
