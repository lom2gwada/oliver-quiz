import type { TranslationKey } from '../i18n'
import { localDay } from './dateFormat'
import { supabase } from './supabase'

/** Pourquoi une action d'administration a été refusée (voir `048_admin_user_actions.sql`) : les garde-fous sont en base, ce
 * sont leurs messages qu'on reconnaît ici. */
export type UserActionFailure =
  | 'forbidden' | 'notFound' | 'self' | 'lastAdmin' | 'invalidPseudo' | 'invalidAvatar' | 'failed'
  // Refus de la fonction Edge `admin-users` (inviter, renvoyer, réinitialiser, changer l'email) :
  | 'invalidEmail' | 'emailExists' | 'rateLimited' | 'notPending' | 'notActive' | 'disabled' | 'noEmail' | 'sendFailed' | 'unavailable'

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
  invalidEmail: 'userAccounts.errorInvalidEmail',
  emailExists: 'userAccounts.errorEmailExists',
  rateLimited: 'userAccounts.errorRateLimited',
  notPending: 'userAccounts.errorNotPending',
  notActive: 'userAccounts.errorNotActive',
  disabled: 'userAccounts.errorDisabled',
  noEmail: 'userAccounts.errorNoEmail',
  sendFailed: 'userAccounts.errorSendFailed',
  unavailable: 'userAccounts.errorUnavailable',
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

/** Autorise (`true`) ou non (`false`) un compte à créer des quiz (`admin_set_user_can_create_quizzes`, 052). Retirer l'autorisation ne retire aucun quiz déjà créé. */
export const setUserCanCreateQuizzes = (userId: string, allowed: boolean) => call<void>('admin_set_user_can_create_quizzes', { p_user_id: userId, p_allowed: allowed })

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

/** Le code `{ error }` d'un refus de la fonction Edge, ou, faute de code (le serveur n'a pas trouvé la fonction : 404 sans corps
 * de la nôtre), « indisponible » — typiquement parce qu'elle n'est pas déployée. */
export function classifyAccountCode(code: unknown, status?: number): UserActionFailure {
  switch (code) {
    case 'invalid_email': return 'invalidEmail'
    case 'email_exists': return 'emailExists'
    case 'rate_limited': return 'rateLimited'
    case 'not_pending': return 'notPending'
    case 'not_active': return 'notActive'
    case 'disabled': return 'disabled'
    case 'no_email': return 'noEmail'
    case 'not_found': return 'notFound'
    case 'self_forbidden': return 'self'
    case 'unauthorized': case 'forbidden': case 'forbidden_origin': return 'forbidden'
    case 'send_failed': return 'sendFailed'
    default: return status === 404 ? 'unavailable' : 'failed'
  }
}

/** Lit le refus d'un appel à la fonction Edge : le corps JSON de la réponse HTTP s'il y en a un, sinon la fonction est injoignable. */
export async function readFunctionError(error: unknown): Promise<UserActionFailure> {
  const context = (error as { context?: { status?: number; json?: () => Promise<unknown> } } | null)?.context
  if (!context || typeof context.json !== 'function') return 'unavailable'
  let payload: unknown = null
  try { payload = await context.json() } catch { /* corps absent ou illisible : on s'en tient au statut */ }
  return classifyAccountCode((payload as { error?: unknown } | null)?.error, context.status)
}

/** Appelle la fonction Edge `admin-users` (`supabase/functions/admin-users`, #231) : inviter, renvoyer une invitation, envoyer un
 * lien de réinitialisation, changer l'email. Elle seule détient la clé de service. Jamais rejouée toute seule : un email part. */
async function callAccountFunction(body: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.functions.invoke('admin-users', { body })
  if (error) throw new UserActionError(await readFunctionError(error))
}

/** Invite une adresse : le compte est créé et l'invitation partie par email ; la personne choisit son mot de passe. */
export const inviteUser = (email: string) => callAccountFunction({ action: 'invite_user', email })

/** Renvoie l'invitation d'un compte qui ne l'a pas encore acceptée. */
export const resendInvite = (userId: string) => callAccountFunction({ action: 'resend_invite', userId })

/** Envoie à un compte actif un lien pour choisir un nouveau mot de passe. */
export const sendPasswordReset = (userId: string) => callAccountFunction({ action: 'send_password_reset', userId })

/** Change l'adresse de connexion d'un compte (jamais le sien) ; effective tout de suite. */
export const changeUserEmail = (userId: string, email: string) => callAccountFunction({ action: 'change_email', userId, email })

/** Tout ce qu'Oliver Quiz conserve sur un utilisateur (`admin_export_user_data`, 050) : compte, profil, parties, journal des questions,
 * progression, accès, actions d'administration sur son compte. Pas les données de Quiz Forge ni de Periodic Quiz (`scope` le dit). */
export type UserDataExport = Record<string, unknown>

/** Exporte les données d'un utilisateur (droit d'accès). L'export est inscrit au journal d'audit. */
export async function exportUserData(userId: string): Promise<UserDataExport> {
  const data = await call<UserDataExport>('admin_export_user_data', { p_user_id: userId })
  if (!data) throw new UserActionError('failed')
  return data
}

/** `donnees-oliver-quiz-alice-2026-11-24.json` : le pseudo sans accents ni caractères gênants pour un nom de fichier. */
export function userDataFilename(pseudo: string, date: Date): string {
  const slug = pseudo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'utilisateur'
  return `donnees-oliver-quiz-${slug}-${localDay(date)}.json`
}

export type AuditAction =
  | 'disable' | 'enable' | 'update_profile' | 'set_admin' | 'reset_progress' | 'delete_user' | 'grant_access' | 'revoke_access'
  | 'invite_user' | 'resend_invite' | 'send_password_reset' | 'change_email' | 'export_user_data' | 'set_can_create_quizzes'

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
    case 'invite_user': return t('audit.invite', admin)
    case 'resend_invite': return t('audit.resendInvite', admin)
    case 'send_password_reset': return t('audit.sendReset', admin)
    case 'change_email': return t('audit.changeEmail', admin)
    case 'export_user_data': return t('audit.exportUserData', admin)
    case 'set_can_create_quizzes': return details.allowed === true ? t('audit.allowCreateQuizzes', admin) : t('audit.denyCreateQuizzes', admin)
    case 'update_profile': {
      const pseudo = asChange(details.pseudo)
      const avatar = asChange(details.avatar)
      const parts = [pseudo && t('audit.changePseudo', pseudo.from, pseudo.to), avatar && t('audit.changeAvatar', avatar.from, avatar.to)].filter(Boolean)
      return t('audit.updateProfile', admin, parts.join(', '))
    }
    default: return t('audit.unknown', admin)
  }
}
