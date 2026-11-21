import type { TranslationKey } from '../i18n'
import { supabase } from './supabase'

/** Pourquoi une action d'administration a été refusée (voir `048_admin_user_actions.sql`) : les garde-fous sont en base, ce
 * sont leurs messages qu'on reconnaît ici. */
export type UserActionFailure = 'forbidden' | 'notFound' | 'self' | 'lastAdmin' | 'invalidPseudo' | 'invalidAvatar' | 'failed'

export function classifyUserActionError(message: string | undefined): UserActionFailure {
  const text = message ?? ''
  if (text.includes('self_forbidden')) return 'self'
  if (text.includes('last_admin')) return 'lastAdmin'
  if (text.includes('invalid_pseudo')) return 'invalidPseudo'
  if (text.includes('invalid_avatar')) return 'invalidAvatar'
  if (text.includes('not_found')) return 'notFound'
  if (text.includes('forbidden')) return 'forbidden'
  return 'failed'
}

/** La clé de traduction du message à montrer pour un refus. */
export const USER_ACTION_ERROR_KEYS: Record<UserActionFailure, TranslationKey> = {
  forbidden: 'userActions.errorForbidden',
  notFound: 'userDetail.notFound',
  self: 'userActions.errorSelf',
  lastAdmin: 'userActions.errorLastAdmin',
  invalidPseudo: 'userActions.errorPseudo',
  invalidAvatar: 'userActions.errorAvatar',
  failed: 'userActions.errorFailed',
}

/** Erreur d'une action : `failure` dit pourquoi, pour choisir le message. */
export class UserActionError extends Error {
  failure: UserActionFailure
  constructor(failure: UserActionFailure, message?: string) {
    super(message ?? failure)
    this.failure = failure
  }
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new UserActionError(classifyUserActionError(error.message), error.message)
  return (data ?? null) as T | null
}

/** Désactive (`true`) ou réactive (`false`) un compte. Le compte est commun à Oliver Quiz, Quiz Forge et Periodic Quiz. */
export const setUserDisabled = (userId: string, disabled: boolean) => call<void>('admin_set_user_disabled', { p_user_id: userId, p_disabled: disabled })

export const updateUserProfile = (userId: string, pseudo: string, avatar: string) => call<void>('admin_update_user_profile', { p_user_id: userId, p_pseudo: pseudo, p_avatar: avatar })

export const setUserAdmin = (userId: string, isAdmin: boolean) => call<void>('admin_set_user_admin', { p_user_id: userId, p_is_admin: isAdmin })

export const setUserQuizAccess = (userId: string, quizId: string, granted: boolean) => call<void>('admin_set_user_quiz_access', { p_user_id: userId, p_quiz_id: quizId, p_granted: granted })

/** Ce que `admin_reset_user_progress` a effacé. */
export interface ResetCounts {
  quiz_results: number
  question_results: number
  streak_results: number
  timed_results: number
  question_progress: number
}

export const resetUserProgress = async (userId: string): Promise<ResetCounts | null> => call<ResetCounts>('admin_reset_user_progress', { p_user_id: userId })

/** Suppression définitive du compte (et de ses données dans toutes les applications du projet). */
export const deleteUser = (userId: string) => call<void>('admin_delete_user', { p_user_id: userId })

export type AuditAction = 'disable' | 'enable' | 'update_profile' | 'set_admin' | 'reset_progress' | 'delete_user' | 'grant_access' | 'revoke_access'

/** Une ligne du journal d'audit : qui a fait quoi, sur qui, quand — avec les pseudos de l'époque, jamais d'email. */
export interface AuditEntry {
  id: string
  created_at: string
  admin_pseudo: string
  target_pseudo: string
  action: AuditAction
  details: Record<string, unknown>
}

/** Les dernières actions d'administration sur un utilisateur, la plus récente d'abord (lecture réservée aux admins, RLS). */
export async function fetchUserAuditLog(userId: string, limit = 20): Promise<AuditEntry[]> {
  const { data, error } = await supabase.from('admin_audit_log').select('id, created_at, admin_pseudo, target_pseudo, action, details').eq('target_id', userId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return (data ?? []) as AuditEntry[]
}

type Translate = (key: TranslationKey, ...args: unknown[]) => string

const asText = (value: unknown) => typeof value === 'string' ? value : ''
const asNumber = (value: unknown) => typeof value === 'number' ? value : 0
const asChange = (value: unknown): { from: string; to: string } | null => {
  if (!value || typeof value !== 'object') return null
  const { from, to } = value as Record<string, unknown>
  return typeof from === 'string' && typeof to === 'string' ? { from, to } : null
}

/** Une ligne du journal en une phrase, dans la langue de l'interface (`t`). Tolère des détails absents ou inattendus. */
export function describeAuditEntry(entry: AuditEntry, t: Translate): string {
  const admin = entry.admin_pseudo || '?'
  const details = entry.details ?? {}
  switch (entry.action) {
    case 'disable': return t('audit.disable', admin)
    case 'enable': return t('audit.enable', admin)
    case 'set_admin': return details.is_admin === true ? t('audit.promote', admin) : t('audit.demote', admin)
    case 'grant_access': return t('audit.grantAccess', admin, asText(details.quiz_title))
    case 'revoke_access': return t('audit.revokeAccess', admin, asText(details.quiz_title))
    case 'reset_progress': return t('audit.resetProgress', admin, asNumber(details.quiz_results) + asNumber(details.streak_results) + asNumber(details.timed_results), asNumber(details.question_results))
    case 'delete_user': return t('audit.deleteUser', admin)
    case 'update_profile': {
      const pseudo = asChange(details.pseudo)
      const avatar = asChange(details.avatar)
      const parts = [pseudo && t('audit.changePseudo', pseudo.from, pseudo.to), avatar && t('audit.changeAvatar', avatar.from, avatar.to)].filter(Boolean)
      return t('audit.updateProfile', admin, parts.join(', '))
    }
    default: return t('audit.unknown', admin)
  }
}
