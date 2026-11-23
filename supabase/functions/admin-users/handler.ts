// Logique de la fonction Edge `admin-users` (#231) : inviter un utilisateur, renvoyer une invitation, envoyer un lien de
// réinitialisation du mot de passe, changer l'adresse email d'un compte.
//
// Ces opérations passent par l'API d'administration de l'authentification, qui exige la clé de service : impossible depuis le
// client ni depuis une fonction SQL. Cette clé n'existe que dans l'environnement de la fonction (`SUPABASE_SERVICE_ROLE_KEY`,
// fournie par Supabase) ; elle n'est ni dans le dépôt ni dans le navigateur.
//
// Ce fichier est volontairement SANS API Deno et sans import : il reçoit tout ce dont il a besoin (`AdminUsersDeps`), ce qui le
// rend testable avec Vitest (`src/utils/adminUsersFunction.test.ts`). `index.ts` le branche sur `@supabase/supabase-js`.

export type AccountAction = 'invite_user' | 'resend_invite' | 'send_password_reset' | 'change_email'

/** Ce que l'API d'authentification renvoie quand elle refuse (`AuthApiError`). */
export interface AuthFailure {
  code?: string
  status?: number
  message?: string
}

export type AuthResult<T> = { ok: true; data: T } | { ok: false; error: AuthFailure }

export interface AuthUserInfo {
  id: string
  email: string | null
  /** Le compte a confirmé son adresse (une invitation acceptée la confirme ; une invitation en attente, non). */
  confirmed: boolean
  /** Compte bloqué (`banned_until` dans le futur). */
  disabled: boolean
}

/** Une ligne du journal d'audit (`admin_audit_log`, 048) : des pseudos, jamais d'email. */
export interface AuditEntry {
  adminId: string
  adminPseudo: string
  targetId: string
  targetPseudo: string
  action: AccountAction
  details: Record<string, unknown>
}

export interface AdminUsersDeps {
  /** Où mènent les liens d'invitation et de réinitialisation : l'application, jamais une adresse donnée par le client. */
  appUrl: string
  /** Origines autorisées à appeler la fonction depuis un navigateur (CORS). */
  allowedOrigins: string[]
  /** L'utilisateur du jeton présenté, ou `null` si le jeton ne vaut rien. */
  getCaller(jwt: string): Promise<{ id: string; disabled: boolean } | null>
  isAdmin(userId: string): Promise<boolean>
  getUser(userId: string): Promise<AuthUserInfo | null>
  pseudoOf(userId: string): Promise<string>
  invite(email: string, redirectTo: string): Promise<AuthResult<{ userId: string }>>
  sendPasswordReset(email: string, redirectTo: string): Promise<AuthResult<null>>
  changeEmail(userId: string, email: string): Promise<AuthResult<null>>
  audit(entry: AuditEntry): Promise<void>
}

export interface HandlerRequest {
  method: string
  origin: string | null
  authorization: string | null
  bodyText: string
}

export interface HandlerResponse {
  status: number
  headers: Record<string, string>
  body: unknown
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Volontairement simple : l'API d'authentification fait la vraie validation ; on écarte seulement ce qui n'a aucune chance.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)

/** L'adresse nettoyée (espaces retirés, minuscules), ou `null` si ce n'en est pas une. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length > 0 && email.length <= 254 && EMAIL.test(email) ? email : null
}

const ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type'

/** Les en-têtes CORS pour cette origine, ou `null` si elle n'est pas autorisée. Sans origine (appel de serveur à serveur) : aucun. */
export function corsHeaders(origin: string | null, allowedOrigins: string[]): Record<string, string> | null {
  if (!origin) return {}
  if (!allowedOrigins.includes(origin)) return null
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

/** Traduit un refus de l'API d'authentification en code stable pour le client (jamais le message brut du serveur). */
export function mapAuthFailure(error: AuthFailure): { status: number; error: string } {
  const code = error.code ?? ''
  const message = error.message ?? ''
  if (code === 'email_exists' || /already (been )?registered|already exists/i.test(message)) return { status: 409, error: 'email_exists' }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || error.status === 429) return { status: 429, error: 'rate_limited' }
  if (code === 'email_address_invalid' || code === 'validation_failed') return { status: 400, error: 'invalid_email' }
  if (code === 'user_not_found') return { status: 404, error: 'not_found' }
  return { status: 502, error: 'send_failed' }
}

function reply(status: number, body: unknown, headers: Record<string, string>): HandlerResponse {
  return { status, headers, body }
}

const fail = (status: number, error: string, headers: Record<string, string>) => reply(status, { error }, headers)

/** Le point d'entrée : vérifie l'origine, le jeton et le statut d'administrateur AVANT toute action, puis exécute celle demandée
 * et l'inscrit au journal d'audit. Les refus portent un code stable (`{ error }`), jamais un détail interne. */
export async function handleAdminUsers(request: HandlerRequest, deps: AdminUsersDeps): Promise<HandlerResponse> {
  const cors = corsHeaders(request.origin, deps.allowedOrigins)
  if (cors === null) return fail(403, 'forbidden_origin', {})

  try {
    if (request.method === 'OPTIONS') return reply(204, null, cors)
    if (request.method !== 'POST') return fail(405, 'method_not_allowed', { ...cors, Allow: 'POST, OPTIONS' })

    const token = /^Bearer\s+(.+)$/i.exec(request.authorization ?? '')?.[1]
    if (!token) return fail(401, 'unauthorized', cors)
    const caller = await deps.getCaller(token)
    if (!caller) return fail(401, 'unauthorized', cors)
    if (caller.disabled || !(await deps.isAdmin(caller.id))) return fail(403, 'forbidden', cors)

    let body: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(request.bodyText)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail(400, 'invalid_request', cors)
      body = parsed as Record<string, unknown>
    } catch {
      return fail(400, 'invalid_request', cors)
    }

    const record = async (action: AccountAction, targetId: string): Promise<boolean> => {
      try {
        const [adminPseudo, targetPseudo] = await Promise.all([deps.pseudoOf(caller.id), deps.pseudoOf(targetId)])
        await deps.audit({ adminId: caller.id, adminPseudo, targetId, targetPseudo, action, details: {} })
        return true
      } catch (error) {
        // L'action a eu lieu (un email est parti) : on ne la présente pas comme un échec, mais on le dit au client.
        console.error('admin-users: audit log write failed', error)
        return false
      }
    }

    switch (body.action) {
      case 'invite_user': {
        const email = normalizeEmail(body.email)
        if (!email) return fail(400, 'invalid_email', cors)
        const result = await deps.invite(email, deps.appUrl)
        if (!result.ok) { const mapped = mapAuthFailure(result.error); return fail(mapped.status, mapped.error, cors) }
        return reply(200, { ok: true, userId: result.data.userId, audited: await record('invite_user', result.data.userId) }, cors)
      }

      case 'resend_invite': {
        if (!isUuid(body.userId)) return fail(400, 'invalid_request', cors)
        const user = await deps.getUser(body.userId)
        if (!user) return fail(404, 'not_found', cors)
        if (user.disabled) return fail(409, 'disabled', cors)
        if (user.confirmed) return fail(409, 'not_pending', cors)
        if (!user.email) return fail(409, 'no_email', cors)
        const result = await deps.invite(user.email, deps.appUrl)
        if (!result.ok) { const mapped = mapAuthFailure(result.error); return fail(mapped.status, mapped.error, cors) }
        return reply(200, { ok: true, audited: await record('resend_invite', user.id) }, cors)
      }

      case 'send_password_reset': {
        if (!isUuid(body.userId)) return fail(400, 'invalid_request', cors)
        const user = await deps.getUser(body.userId)
        if (!user) return fail(404, 'not_found', cors)
        if (user.disabled) return fail(409, 'disabled', cors)
        if (!user.confirmed) return fail(409, 'not_active', cors)
        if (!user.email) return fail(409, 'no_email', cors)
        const result = await deps.sendPasswordReset(user.email, deps.appUrl)
        if (!result.ok) { const mapped = mapAuthFailure(result.error); return fail(mapped.status, mapped.error, cors) }
        return reply(200, { ok: true, audited: await record('send_password_reset', user.id) }, cors)
      }

      case 'change_email': {
        if (!isUuid(body.userId)) return fail(400, 'invalid_request', cors)
        const email = normalizeEmail(body.email)
        if (!email) return fail(400, 'invalid_email', cors)
        // Même garde-fou que les actions de la base (048) : une faute de frappe sur son propre compte le rendrait inaccessible.
        if (body.userId === caller.id) return fail(403, 'self_forbidden', cors)
        const user = await deps.getUser(body.userId)
        if (!user) return fail(404, 'not_found', cors)
        const result = await deps.changeEmail(user.id, email)
        if (!result.ok) { const mapped = mapAuthFailure(result.error); return fail(mapped.status, mapped.error, cors) }
        return reply(200, { ok: true, audited: await record('change_email', user.id) }, cors)
      }

      default:
        return fail(400, 'invalid_request', cors)
    }
  } catch (error) {
    console.error('admin-users: unexpected error', error)
    return fail(500, 'internal', cors)
  }
}
