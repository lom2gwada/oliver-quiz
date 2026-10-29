import type { QuizResultRow, StreakResultRow, TimedResultRow } from '../types/history'

/** Une ligne de l'onglet « Parties » : une partie de n'importe quel mode, avec sa ligne de résultats d'origine. */
export type HistoryGame =
  | { mode: 'classic'; id: string; created_at: string; row: QuizResultRow }
  | { mode: 'streak'; id: string; created_at: string; row: StreakResultRow }
  | { mode: 'timed'; id: string; created_at: string; row: TimedResultRow }

/** Toutes les parties d'un quiz, tous modes confondus, de la plus récente à la plus ancienne. Une partie
 * contre-la-montre sans aucune question tentée (« ✅ 0 / 0 ») n'a rien à montrer : elle n'en fait pas partie, comme dans
 * « Parties jouées » de « Mes quiz ». */
export function mergeGames(classic: QuizResultRow[], streak: StreakResultRow[], timed: TimedResultRow[]): HistoryGame[] {
  const games: HistoryGame[] = [
    ...classic.map((row): HistoryGame => ({ mode: 'classic', id: row.id, created_at: row.created_at, row })),
    ...streak.map((row): HistoryGame => ({ mode: 'streak', id: row.id, created_at: row.created_at, row })),
    ...timed.filter((row) => row.question_count > 0).map((row): HistoryGame => ({ mode: 'timed', id: row.id, created_at: row.created_at, row })),
  ]
  return games.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}
