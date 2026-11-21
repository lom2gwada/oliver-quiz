import { normalizeSearch } from './questionSearch'
import { retryWithBackoff } from './retry'
import { supabase } from './supabase'

/** Un utilisateur dans la liste de l'administration (`admin_list_users()`, voir `047_admin_users.sql`). */
export interface AdminUser {
  user_id: string
  pseudo: string
  avatar: string
  email: string | null
  is_admin: boolean
  /** Création du compte. */
  created_at: string
  last_sign_in_at: string | null
  /** Compte bloqué : il ne peut plus se connecter. */
  disabled: boolean
  /** Parties de tous les modes. */
  games_played: number
  last_played_at: string | null
}

/** Ce qu'un utilisateur a fait sur un quiz : sa progression, jamais ses réponses question par question. */
export interface AdminUserQuiz {
  quiz_id: string
  quiz_title: string
  question_count: number
  seen_count: number
  games_played: number
  last_played_at: string | null
  /** Accès accordé explicitement par un administrateur (un quiz public n'en a pas besoin). */
  has_access: boolean
  is_public: boolean
}

/** La fiche d'un utilisateur (`admin_user_detail()`). */
export interface AdminUserDetail extends AdminUser {
  games: { classic: number; streak: number; timed: number }
  quizzes: AdminUserQuiz[]
}

export type UserStatus = 'active' | 'disabled' | 'never'
export type UserFilter = 'all' | 'admins' | 'disabled' | 'never'
export type UserSort = 'pseudo' | 'created' | 'lastSignIn' | 'games'

export const USER_FILTERS: UserFilter[] = ['all', 'admins', 'disabled', 'never']
export const USER_SORTS: UserSort[] = ['pseudo', 'created', 'lastSignIn', 'games']

/** Un compte bloqué l'est même s'il ne s'est jamais connecté ; sinon, sans connexion, il n'a jamais servi. */
export const userStatus = (user: Pick<AdminUser, 'disabled' | 'last_sign_in_at'>): UserStatus =>
  user.disabled ? 'disabled' : user.last_sign_in_at ? 'active' : 'never'

/** Les utilisateurs dont le pseudo ou l'email contient la recherche (sans tenir compte des accents ni de la casse), puis le
 * filtre : administrateurs, comptes bloqués, ou comptes jamais connectés. */
export function filterUsers(users: AdminUser[], query: string, filter: UserFilter): AdminUser[] {
  const wanted = normalizeSearch(query)
  return users.filter((user) => {
    if (wanted && !normalizeSearch(`${user.pseudo} ${user.email ?? ''}`).includes(wanted)) return false
    if (filter === 'admins') return user.is_admin
    if (filter === 'disabled') return userStatus(user) === 'disabled'
    if (filter === 'never') return userStatus(user) === 'never'
    return true
  })
}

/** Date la plus récente d'abord, les dates absentes à la fin. */
const newestFirst = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '')

/** Trie sans modifier la liste d'origine. Pseudo : alphabétique ; inscription et dernière connexion : récentes d'abord (les
 * comptes jamais connectés à la fin) ; parties : les plus actifs d'abord. À égalité, l'ordre alphabétique des pseudos. */
export function sortUsers(users: AdminUser[], sort: UserSort): AdminUser[] {
  const byPseudo = (a: AdminUser, b: AdminUser) => a.pseudo.localeCompare(b.pseudo, undefined, { sensitivity: 'base' })
  const compare: Record<UserSort, (a: AdminUser, b: AdminUser) => number> = {
    pseudo: byPseudo,
    created: (a, b) => newestFirst(a.created_at, b.created_at),
    lastSignIn: (a, b) => (a.last_sign_in_at === null) !== (b.last_sign_in_at === null)
      ? (a.last_sign_in_at === null ? 1 : -1)
      : newestFirst(a.last_sign_in_at, b.last_sign_in_at),
    games: (a, b) => b.games_played - a.games_played,
  }
  return [...users].sort((a, b) => compare[sort](a, b) || byPseudo(a, b))
}

export interface UsersSummary {
  total: number
  admins: number
  disabled: number
  never: number
}

export function summarizeUsers(users: AdminUser[]): UsersSummary {
  return {
    total: users.length,
    admins: users.filter((user) => user.is_admin).length,
    disabled: users.filter((user) => userStatus(user) === 'disabled').length,
    never: users.filter((user) => userStatus(user) === 'never').length,
  }
}

/** Les quiz à montrer sur une fiche : ceux auxquels l'utilisateur a accès (accordé ou public) ou qu'il a déjà abordés. Un quiz
 * privé sans accès ni activité ne le concerne pas. */
export const visibleUserQuizzes = (quizzes: AdminUserQuiz[]): AdminUserQuiz[] =>
  quizzes.filter((quiz) => quiz.has_access || quiz.is_public || quiz.games_played > 0 || quiz.seen_count > 0)

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  return retryWithBackoff(async () => {
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) throw error
    return (data ?? []) as AdminUser[]
  }, { delaysMs: [600, 1800] })
}

export type UserDetailFailure = 'notFound' | 'failed'

/** Pourquoi `admin_user_detail()` a refusé : l'utilisateur n'existe (plus) pas, ou autre chose (réseau, droits). */
export const classifyUserDetailError = (message: string | undefined): UserDetailFailure => message?.includes('not_found') ? 'notFound' : 'failed'

/** La fiche d'un utilisateur ; lève `{ failure }` quand elle ne peut pas être lue. Sans reprise automatique : « introuvable »
 * ne se rattrape pas, et l'écran propose « Réessayer ». */
export async function fetchAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const { data, error } = await supabase.rpc('admin_user_detail', { p_user_id: userId })
  if (error) throw Object.assign(new Error(error.message), { failure: classifyUserDetailError(error.message) })
  return data as AdminUserDetail
}
