// Fonction Edge `admin-users` (#231) : point d'entrée Deno. Toute la logique est dans `handler.ts` (testée avec Vitest) ; ce fichier
// ne fait que la brancher sur l'API Supabase.
//
// Variables d'environnement :
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — fournies par Supabase aux fonctions Edge, rien à configurer.
//   APP_URL         (facultatif) où mènent les liens d'invitation et de réinitialisation. Défaut : le site publié. Cette adresse
//                   doit figurer dans Authentication > URL Configuration > Redirect URLs, sinon Supabase ignore la redirection.
//   ALLOWED_ORIGINS (facultatif) origines autorisées à appeler la fonction depuis un navigateur, séparées par des virgules.
//
// La clé de service ne quitte jamais cette fonction : elle n'est ni dans le dépôt, ni dans le navigateur.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleAdminUsers, type AdminUsersDeps, type AuthFailure } from './handler.ts'

const DEFAULT_APP_URL = 'https://lom2gwada.github.io/oliver-quiz/'
const DEFAULT_ORIGINS = ['https://lom2gwada.github.io', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const options = { auth: { autoRefreshToken: false, persistSession: false } }
// Clé de service : accès complet, hors RLS. Sert à vérifier l'appelant, lire les comptes, inviter et écrire au journal.
const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', options)
// Clé publique : l'envoi d'un lien de réinitialisation passe par l'API ouverte, comme pour un utilisateur qui l'aurait demandé.
const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', options)

const failure = (error: { code?: string; status?: number; message?: string }): { ok: false; error: AuthFailure } => ({
  ok: false,
  error: { code: error.code, status: error.status, message: error.message },
})

const origins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((origin) => origin.trim()).filter(Boolean)

const deps: AdminUsersDeps = {
  appUrl: Deno.env.get('APP_URL') || DEFAULT_APP_URL,
  allowedOrigins: origins.length > 0 ? origins : DEFAULT_ORIGINS,

  async getCaller(jwt) {
    const { data, error } = await admin.auth.getUser(jwt)
    if (error || !data.user) return null
    const bannedUntil = (data.user as unknown as { banned_until?: string | null }).banned_until
    return { id: data.user.id, disabled: !!bannedUntil && new Date(bannedUntil).getTime() > Date.now() }
  },

  async isAdmin(userId) {
    const { data, error } = await admin.from('profiles').select('is_admin').eq('id', userId).maybeSingle()
    if (error) throw error
    return data?.is_admin === true
  },

  async getUser(userId) {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error || !data.user) return null
    const user = data.user as unknown as { id: string; email?: string | null; email_confirmed_at?: string | null; confirmed_at?: string | null; banned_until?: string | null }
    return {
      id: user.id,
      email: user.email ?? null,
      confirmed: !!(user.email_confirmed_at || user.confirmed_at),
      disabled: !!user.banned_until && new Date(user.banned_until).getTime() > Date.now(),
    }
  },

  async pseudoOf(userId) {
    const { data } = await admin.from('profiles').select('pseudo').eq('id', userId).maybeSingle()
    return data?.pseudo ?? ''
  },

  async invite(email, redirectTo) {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
    if (error || !data.user) return failure(error ?? {})
    return { ok: true, data: { userId: data.user.id } }
  },

  async sendPasswordReset(email, redirectTo) {
    const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo })
    return error ? failure(error) : { ok: true, data: null }
  },

  async changeEmail(userId, email) {
    // `email_confirm: true` : l'adresse est effective tout de suite, sans mail de confirmation à la nouvelle adresse (c'est un
    // acte d'administrateur ; l'interface le dit avant de demander confirmation).
    const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true })
    return error ? failure(error) : { ok: true, data: null }
  },

  async audit(entry) {
    // Écriture directe : `admin_audit()` (048) s'appuie sur `auth.uid()`, absent ici ; la clé de service passe outre la RLS.
    const { error } = await admin.from('admin_audit_log').insert({
      admin_id: entry.adminId,
      admin_pseudo: entry.adminPseudo,
      target_id: entry.targetId,
      target_pseudo: entry.targetPseudo,
      action: entry.action,
      details: entry.details,
    })
    if (error) throw error
  },
}

Deno.serve(async (request) => {
  const result = await handleAdminUsers({
    method: request.method,
    origin: request.headers.get('origin'),
    authorization: request.headers.get('authorization'),
    bodyText: request.method === 'POST' ? await request.text() : '',
  }, deps)
  return new Response(result.body === null ? null : JSON.stringify(result.body), {
    status: result.status,
    headers: { ...(result.body === null ? {} : { 'Content-Type': 'application/json' }), ...result.headers },
  })
})
