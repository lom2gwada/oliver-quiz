import type { TranslationKey } from '../i18n'
import { supabase } from './supabase'

/** Le rôle d'un compte sur un quiz (voir `051_quiz_admins.sql`) : le propriétaire peut tout, y compris rendre le quiz public,
 * gérer la liste des administrateurs et supprimer le quiz ; l'administrateur gère le contenu, les accès et les liens invités. */
export type QuizRole = 'owner' | 'admin'

export interface QuizAdmin {
  user_id: string
  pseudo: string
  avatar: string
  role: QuizRole
  /** Le pseudo de qui l'a ajouté, `null` si ce compte n'existe plus. */
  added_by_pseudo: string | null
  added_at: string
  is_self: boolean
  disabled: boolean
}

/** Un compte trouvé par pseudo : jamais d'email. `role` est `null` s'il n'administre pas encore ce quiz. */
export interface QuizUserMatch {
  user_id: string
  pseudo: string
  avatar: string
  role: QuizRole | null
  has_access: boolean
}

export interface QuizAccessUser {
  user_id: string
  pseudo: string
  avatar: string
}

/** Pourquoi une action sur les administrateurs d'un quiz a été refusée : les garde-fous sont en base, ce sont leurs messages
 * qu'on reconnaît ici. */
export type QuizAdminFailure = 'forbidden' | 'notFound' | 'lastOwner' | 'userDisabled' | 'invalidRole' | 'conflict' | 'soleOwner' | 'failed'

export function classifyQuizAdminError(message: string | undefined): QuizAdminFailure {
  const text = message ?? ''
  if (text.includes('last_owner')) return 'lastOwner'
  if (text.includes('sole_quiz_owner')) return 'soleOwner'
  if (text.includes('user_disabled')) return 'userDisabled'
  if (text.includes('invalid_role')) return 'invalidRole'
  if (text.includes('conflict')) return 'conflict'
  if (text.includes('not_found')) return 'notFound'
  if (text.includes('forbidden') || text.includes('row-level security')) return 'forbidden'
  return 'failed'
}

/** La clé de traduction du message à montrer pour un refus. */
export const QUIZ_ADMIN_ERROR_KEYS: Record<QuizAdminFailure, TranslationKey> = {
  forbidden: 'quizAdmin.errorForbidden',
  notFound: 'quizAdmin.errorNotFound',
  lastOwner: 'quizAdmin.errorLastOwner',
  userDisabled: 'quizAdmin.errorUserDisabled',
  invalidRole: 'quizAdmin.errorInvalidRole',
  conflict: 'quizAdmin.errorConflict',
  soleOwner: 'quizAdmin.errorSoleOwner',
  failed: 'quizAdmin.errorFailed',
}

/** Erreur d'une action : `failure` dit pourquoi, pour choisir le message. */
export class QuizAdminError extends Error {
  failure: QuizAdminFailure
  constructor(failure: QuizAdminFailure, message?: string) {
    super(message ?? failure)
    this.failure = failure
  }
}

const asArray = <T>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : [])

/** Les quiz que le compte connecté administre, avec son rôle (chacun ne lit que ses propres lignes). L'administrateur global
 * administre tous les quiz sans y figurer : l'appelant le sait par son profil. */
export async function fetchMyQuizRoles(): Promise<Record<string, QuizRole>> {
  const { data, error } = await supabase.from('quiz_admins').select('quiz_id, role')
  if (error) throw error
  const roles: Record<string, QuizRole> = {}
  for (const row of data ?? []) roles[row.quiz_id] = row.role as QuizRole
  return roles
}

/** Les propriétaires puis les administrateurs du quiz, pour le panneau « Administrateurs ». Réservé aux administrateurs du quiz. */
export async function listQuizAdmins(quizId: string): Promise<QuizAdmin[]> {
  const { data, error } = await supabase.rpc('quiz_admins_list', { p_quiz_id: quizId })
  if (error) throw new QuizAdminError(classifyQuizAdminError(error.message), error.message)
  return asArray<QuizAdmin>(data)
}

/** Les comptes qui ont accès au quiz. Réservé aux administrateurs du quiz. */
export async function fetchQuizAccessUsers(quizId: string): Promise<QuizAccessUser[]> {
  const { data, error } = await supabase.rpc('quiz_access_users', { p_quiz_id: quizId })
  if (error) throw new QuizAdminError(classifyQuizAdminError(error.message), error.message)
  return asArray<QuizAccessUser>(data)
}

/** Cherche un compte par pseudo (début du pseudo ou d'un de ses mots, 2 caractères au moins, 10 résultats au plus, comptes
 * désactivés exclus). Réservé aux administrateurs du quiz ; la réponse ne contient jamais d'email. */
export async function searchQuizUsers(quizId: string, query: string): Promise<QuizUserMatch[]> {
  if (query.trim().length < 2) return []
  const { data, error } = await supabase.rpc('quiz_search_users', { p_quiz_id: quizId, p_query: query })
  if (error) throw new QuizAdminError(classifyQuizAdminError(error.message), error.message)
  return asArray<QuizUserMatch>(data)
}

async function call(fn: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.rpc(fn, args)
  if (error) throw new QuizAdminError(classifyQuizAdminError(error.message), error.message)
}

/** Ajoute un compte comme administrateur ou propriétaire du quiz, ou change son rôle (promotion, rétrogradation). Propriétaires
 * seulement ; jamais le dernier propriétaire. Sans effet si le rôle est déjà le bon. */
export const setQuizAdminRole = (quizId: string, userId: string, role: QuizRole) => call('quiz_set_admin_role', { p_quiz_id: quizId, p_user_id: userId, p_role: role })

/** Retire un administrateur ou un propriétaire. Propriétaires seulement, sauf pour un administrateur qui se retire lui-même ;
 * jamais le dernier propriétaire. */
export const removeQuizAdmin = (quizId: string, userId: string) => call('quiz_remove_admin', { p_quiz_id: quizId, p_user_id: userId })
