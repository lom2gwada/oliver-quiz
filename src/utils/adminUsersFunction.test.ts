import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  corsHeaders, handleAdminUsers, isUuid, mapAuthFailure, normalizeEmail,
  type AdminUsersDeps, type AuditEntry, type AuthUserInfo, type HandlerRequest,
} from '../../supabase/functions/admin-users/handler'

const APP_URL = 'https://lom2gwada.github.io/oliver-quiz/'
const ORIGIN = 'https://lom2gwada.github.io'
const ADMIN = '11111111-1111-4111-8111-111111111111'
const PLAYER = '22222222-2222-4222-8222-222222222222'
const TARGET = '33333333-3333-4333-8333-333333333333'

const pseudos: Record<string, string> = { [ADMIN]: 'Olivier', [PLAYER]: 'Joueur', [TARGET]: 'Alice' }
const user = (overrides: Partial<AuthUserInfo> = {}): AuthUserInfo => ({ id: TARGET, email: 'alice@example.com', confirmed: true, disabled: false, ...overrides })

let audits: AuditEntry[]
function makeDeps(overrides: Partial<AdminUsersDeps> = {}): AdminUsersDeps {
  return {
    appUrl: APP_URL,
    allowedOrigins: [ORIGIN, 'http://localhost:5175'],
    getCaller: vi.fn(async (jwt: string) => jwt === 'admin-token' ? { id: ADMIN, disabled: false } : jwt === 'player-token' ? { id: PLAYER, disabled: false } : jwt === 'banned-token' ? { id: ADMIN, disabled: true } : null),
    isAdmin: vi.fn(async (id: string) => id === ADMIN),
    getUser: vi.fn(async (id: string) => id === TARGET ? user() : null),
    pseudoOf: vi.fn(async (id: string) => pseudos[id] ?? ''),
    invite: vi.fn(async () => ({ ok: true as const, data: { userId: TARGET } })),
    sendPasswordReset: vi.fn(async () => ({ ok: true as const, data: null })),
    changeEmail: vi.fn(async () => ({ ok: true as const, data: null })),
    audit: vi.fn(async (entry: AuditEntry) => { audits.push(entry) }),
    ...overrides,
  }
}

const post = (body: unknown, overrides: Partial<HandlerRequest> = {}): HandlerRequest => ({
  method: 'POST', origin: ORIGIN, authorization: 'Bearer admin-token', bodyText: typeof body === 'string' ? body : JSON.stringify(body), ...overrides,
})

beforeEach(() => { audits = []; vi.spyOn(console, 'error').mockImplementation(() => {}) })

describe('normalizeEmail', () => {
  it('trims and lowercases a valid address', () => {
    expect(normalizeEmail('  Alice@Example.COM ')).toBe('alice@example.com')
  })

  it.each(['', '   ', 'alice', 'alice@', '@example.com', 'a b@example.com', 'alice@example', 42, null, undefined, { a: 1 }, 'a@b.c'.padEnd(300, 'x')])('rejects %j', (value) => {
    expect(normalizeEmail(value)).toBeNull()
  })
})

describe('isUuid', () => {
  it('accepts a uuid and nothing else', () => {
    expect(isUuid(TARGET)).toBe(true)
    for (const value of ['', 'abc', TARGET + 'x', 42, null, undefined]) expect(isUuid(value)).toBe(false)
  })
})

describe('corsHeaders', () => {
  it('echoes an allowed origin only', () => {
    expect(corsHeaders(ORIGIN, [ORIGIN])).toMatchObject({ 'Access-Control-Allow-Origin': ORIGIN, Vary: 'Origin' })
    expect(corsHeaders('https://evil.example', [ORIGIN])).toBeNull()
  })

  it('lets a call without origin through, without CORS headers', () => {
    expect(corsHeaders(null, [ORIGIN])).toEqual({})
  })

  it('allows the headers the Supabase client sends', () => {
    expect(corsHeaders(ORIGIN, [ORIGIN])!['Access-Control-Allow-Headers']).toMatch(/authorization.*apikey.*content-type/)
  })
})

describe('mapAuthFailure', () => {
  it.each([
    [{ code: 'email_exists', status: 422 }, 409, 'email_exists'],
    [{ message: 'A user with this email address has already been registered' }, 409, 'email_exists'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 429, 'rate_limited'],
    [{ status: 429 }, 429, 'rate_limited'],
    [{ code: 'email_address_invalid' }, 400, 'invalid_email'],
    [{ code: 'user_not_found' }, 404, 'not_found'],
    [{ code: 'unexpected_failure', status: 500, message: 'SMTP exploded' }, 502, 'send_failed'],
    [{}, 502, 'send_failed'],
  ])('maps %j to %i %s', (failure, status, error) => {
    expect(mapAuthFailure(failure)).toEqual({ status, error })
  })
})

describe('who may call the function', () => {
  it('answers a CORS preflight from an allowed origin, without any token', async () => {
    const deps = makeDeps()
    const response = await handleAdminUsers({ method: 'OPTIONS', origin: ORIGIN, authorization: null, bodyText: '' }, deps)
    expect(response.status).toBe(204)
    expect(response.headers['Access-Control-Allow-Origin']).toBe(ORIGIN)
    expect(deps.getCaller).not.toHaveBeenCalled()
  })

  it('refuses an origin that is not allowed, for the preflight and for the call', async () => {
    const deps = makeDeps()
    for (const method of ['OPTIONS', 'POST']) {
      const response = await handleAdminUsers(post({ action: 'invite_user', email: 'a@b.fr' }, { method, origin: 'https://evil.example' }), deps)
      expect(response.status).toBe(403)
      expect(response.body).toEqual({ error: 'forbidden_origin' })
      expect(response.headers['Access-Control-Allow-Origin']).toBeUndefined()
    }
    expect(deps.invite).not.toHaveBeenCalled()
  })

  it('refuses anything but POST', async () => {
    const response = await handleAdminUsers(post('', { method: 'GET' }), makeDeps())
    expect(response.status).toBe(405)
    expect(response.headers.Allow).toBe('POST, OPTIONS')
  })

  it('refuses a call without token, or with a token that is worth nothing', async () => {
    for (const authorization of [null, '', 'Basic abc', 'Bearer', 'Bearer unknown-token']) {
      const deps = makeDeps()
      const response = await handleAdminUsers(post({ action: 'invite_user', email: 'a@b.fr' }, { authorization }), deps)
      expect(response.status, String(authorization)).toBe(401)
      expect(response.body).toEqual({ error: 'unauthorized' })
      expect(deps.invite).not.toHaveBeenCalled()
    }
  })

  it('refuses an ordinary player, even with a valid token', async () => {
    const deps = makeDeps()
    const response = await handleAdminUsers(post({ action: 'invite_user', email: 'a@b.fr' }, { authorization: 'Bearer player-token' }), deps)
    expect(response.status).toBe(403)
    expect(response.body).toEqual({ error: 'forbidden' })
    expect(deps.invite).not.toHaveBeenCalled()
    expect(deps.getUser).not.toHaveBeenCalled()
    expect(audits).toEqual([])
  })

  it('refuses an administrator whose account has been disabled', async () => {
    const deps = makeDeps()
    const response = await handleAdminUsers(post({ action: 'invite_user', email: 'a@b.fr' }, { authorization: 'Bearer banned-token' }), deps)
    expect(response.status).toBe(403)
    expect(deps.invite).not.toHaveBeenCalled()
  })

  it('checks the administrator before it even reads the request body', async () => {
    const deps = makeDeps()
    const response = await handleAdminUsers(post('{not json', { authorization: 'Bearer player-token' }), deps)
    expect(response.status).toBe(403)
  })

  it('does not reveal an internal failure', async () => {
    const deps = makeDeps({ getCaller: vi.fn(async () => { throw new Error('database password is hunter2') }) })
    const response = await handleAdminUsers(post({ action: 'invite_user', email: 'a@b.fr' }), deps)
    expect(response.status).toBe(500)
    expect(JSON.stringify(response.body)).not.toContain('hunter2')
    expect(response.body).toEqual({ error: 'internal' })
  })

  it('refuses a malformed body or an unknown action', async () => {
    for (const bodyText of ['{not json', 'null', '[]', '"invite"', '{}', JSON.stringify({ action: 'drop_database' })]) {
      const response = await handleAdminUsers(post(bodyText), makeDeps())
      expect(response.status, bodyText).toBe(400)
      expect(response.body).toEqual({ error: 'invalid_request' })
    }
  })

  it('adds the CORS headers to every answer to an allowed origin', async () => {
    for (const request of [post({ action: 'x' }), post({ action: 'x' }, { authorization: null }), post({ action: 'x' }, { authorization: 'Bearer player-token' })]) {
      expect((await handleAdminUsers(request, makeDeps())).headers['Access-Control-Allow-Origin']).toBe(ORIGIN)
    }
  })
})

describe('invite_user', () => {
  it('invites the normalised address, always towards the application, and logs it', async () => {
    const deps = makeDeps()
    const response = await handleAdminUsers(post({ action: 'invite_user', email: '  New@Example.com ', redirectTo: 'https://evil.example' }), deps)
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, userId: TARGET, audited: true })
    expect(deps.invite).toHaveBeenCalledWith('new@example.com', APP_URL)
    expect(audits).toEqual([{ adminId: ADMIN, adminPseudo: 'Olivier', targetId: TARGET, targetPseudo: 'Alice', action: 'invite_user', details: {} }])
  })

  it('never puts an email in the audit log', async () => {
    await handleAdminUsers(post({ action: 'invite_user', email: 'new@example.com' }), makeDeps())
    expect(JSON.stringify(audits)).not.toContain('@')
  })

  it('rejects an invalid address before calling the authentication API', async () => {
    const deps = makeDeps()
    const response = await handleAdminUsers(post({ action: 'invite_user', email: 'not an email' }), deps)
    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'invalid_email' })
    expect(deps.invite).not.toHaveBeenCalled()
  })

  it.each([
    [{ code: 'email_exists' }, 409, 'email_exists'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 429, 'rate_limited'],
    [{ code: 'smtp_failed', message: 'boom' }, 502, 'send_failed'],
  ])('reports %j as %i %s, and logs nothing', async (error, status, code) => {
    const deps = makeDeps({ invite: vi.fn(async () => ({ ok: false as const, error })) })
    const response = await handleAdminUsers(post({ action: 'invite_user', email: 'a@b.fr' }), deps)
    expect(response.status).toBe(status)
    expect(response.body).toEqual({ error: code })
    expect(audits).toEqual([])
  })

  it('still succeeds, and says so, when only the audit log write fails', async () => {
    const deps = makeDeps({ audit: vi.fn(async () => { throw new Error('insert failed') }) })
    const response = await handleAdminUsers(post({ action: 'invite_user', email: 'a@b.fr' }), deps)
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true, userId: TARGET, audited: false })
  })
})

describe('resend_invite', () => {
  it('re-sends the invitation of an account that has not accepted yet', async () => {
    const deps = makeDeps({ getUser: vi.fn(async () => user({ confirmed: false })) })
    const response = await handleAdminUsers(post({ action: 'resend_invite', userId: TARGET }), deps)
    expect(response.status).toBe(200)
    expect(deps.invite).toHaveBeenCalledWith('alice@example.com', APP_URL)
    expect(audits[0]).toMatchObject({ action: 'resend_invite', targetId: TARGET })
  })

  it('refuses an account that already accepted, a disabled one and one without address', async () => {
    const cases: [Partial<AuthUserInfo>, number, string][] = [[{ confirmed: true }, 409, 'not_pending'], [{ confirmed: false, disabled: true }, 409, 'disabled'], [{ confirmed: false, email: null }, 409, 'no_email']]
    for (const [overrides, status, error] of cases) {
      const deps = makeDeps({ getUser: vi.fn(async () => user(overrides)) })
      const response = await handleAdminUsers(post({ action: 'resend_invite', userId: TARGET }), deps)
      expect([response.status, response.body]).toEqual([status, { error }])
      expect(deps.invite).not.toHaveBeenCalled()
    }
    expect(audits).toEqual([])
  })

  it('answers not found for an unknown account and rejects a bad id', async () => {
    expect((await handleAdminUsers(post({ action: 'resend_invite', userId: '44444444-4444-4444-8444-444444444444' }), makeDeps())).status).toBe(404)
    expect((await handleAdminUsers(post({ action: 'resend_invite', userId: 'nope' }), makeDeps())).status).toBe(400)
  })
})

describe('send_password_reset', () => {
  it('sends the link to an active account, towards the application, and logs it', async () => {
    const deps = makeDeps()
    const response = await handleAdminUsers(post({ action: 'send_password_reset', userId: TARGET }), deps)
    expect(response.status).toBe(200)
    expect(deps.sendPasswordReset).toHaveBeenCalledWith('alice@example.com', APP_URL)
    expect(audits[0]).toMatchObject({ action: 'send_password_reset', targetId: TARGET })
  })

  it('refuses a pending invitation (re-send the invitation instead), a disabled account and one without address', async () => {
    const cases: [Partial<AuthUserInfo>, string][] = [[{ confirmed: false }, 'not_active'], [{ disabled: true }, 'disabled'], [{ email: null }, 'no_email']]
    for (const [overrides, error] of cases) {
      const deps = makeDeps({ getUser: vi.fn(async () => user(overrides)) })
      const response = await handleAdminUsers(post({ action: 'send_password_reset', userId: TARGET }), deps)
      expect([response.status, response.body]).toEqual([409, { error }])
      expect(deps.sendPasswordReset).not.toHaveBeenCalled()
    }
  })

  it('reports a rate limit without logging anything', async () => {
    const deps = makeDeps({ sendPasswordReset: vi.fn(async () => ({ ok: false as const, error: { code: 'over_email_send_rate_limit', status: 429 } })) })
    const response = await handleAdminUsers(post({ action: 'send_password_reset', userId: TARGET }), deps)
    expect([response.status, response.body]).toEqual([429, { error: 'rate_limited' }])
    expect(audits).toEqual([])
  })
})

describe('change_email', () => {
  it('changes the address of another account and logs it without any address', async () => {
    const deps = makeDeps()
    const response = await handleAdminUsers(post({ action: 'change_email', userId: TARGET, email: ' New@Example.com ' }), deps)
    expect(response.status).toBe(200)
    expect(deps.changeEmail).toHaveBeenCalledWith(TARGET, 'new@example.com')
    expect(audits[0]).toMatchObject({ action: 'change_email', targetId: TARGET, details: {} })
    expect(JSON.stringify(audits)).not.toContain('@')
  })

  it('refuses to change the administrator’s own address', async () => {
    const deps = makeDeps()
    const response = await handleAdminUsers(post({ action: 'change_email', userId: ADMIN, email: 'new@example.com' }), deps)
    expect([response.status, response.body]).toEqual([403, { error: 'self_forbidden' }])
    expect(deps.changeEmail).not.toHaveBeenCalled()
  })

  it('rejects an invalid address, a bad id and an unknown account', async () => {
    expect((await handleAdminUsers(post({ action: 'change_email', userId: TARGET, email: 'nope' }), makeDeps())).body).toEqual({ error: 'invalid_email' })
    expect((await handleAdminUsers(post({ action: 'change_email', userId: 'nope', email: 'a@b.fr' }), makeDeps())).body).toEqual({ error: 'invalid_request' })
    expect((await handleAdminUsers(post({ action: 'change_email', userId: '44444444-4444-4444-8444-444444444444', email: 'a@b.fr' }), makeDeps())).status).toBe(404)
  })

  it('reports an address already used by another account', async () => {
    const deps = makeDeps({ changeEmail: vi.fn(async () => ({ ok: false as const, error: { code: 'email_exists', status: 422 } })) })
    const response = await handleAdminUsers(post({ action: 'change_email', userId: TARGET, email: 'taken@example.com' }), deps)
    expect([response.status, response.body]).toEqual([409, { error: 'email_exists' }])
    expect(audits).toEqual([])
  })
})
