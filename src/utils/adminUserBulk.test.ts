import { describe, expect, it } from 'vitest'
import { UserActionError } from './adminUserActions'
import type { AdminUser } from './adminUsers'
import { namesPreview, planBulk, runBulk } from './adminUserBulk'

const user = (pseudo: string, overrides: Partial<AdminUser> = {}): AdminUser => ({
  user_id: `id-${pseudo}`, pseudo, avatar: '🙂', email: `${pseudo.toLowerCase()}@example.com`, is_admin: false, is_self: false,
  created_at: '2026-08-26T10:00:00Z', last_sign_in_at: '2026-10-26T10:00:00Z', disabled: false, games_played: 0, last_played_at: null,
  ...overrides,
})
const pseudos = (users: AdminUser[]) => users.map((item) => item.pseudo)

const me = user('Me', { is_self: true, is_admin: true })
const alice = user('Alice')
const bob = user('Bob', { disabled: true })

describe('planBulk — disable', () => {
  it('leaves out the administrator’s own account and the accounts already disabled', () => {
    const plan = planBulk('disable', [me, alice, bob])
    expect(pseudos(plan.targets)).toEqual(['Alice'])
    expect(plan.skipped.map((item) => [item.user.pseudo, item.reason])).toEqual([['Me', 'self'], ['Bob', 'already']])
  })
})

describe('planBulk — enable', () => {
  it('only concerns the accounts that are disabled', () => {
    const plan = planBulk('enable', [me, alice, bob])
    expect(pseudos(plan.targets)).toEqual(['Bob'])
    expect(plan.skipped.map((item) => [item.user.pseudo, item.reason])).toEqual([['Me', 'already'], ['Alice', 'already']])
  })
})

describe('planBulk — access', () => {
  it.each(['grant', 'revoke'] as const)('concerns everybody for %s, the list not knowing who already has access', (action) => {
    const plan = planBulk(action, [me, alice, bob])
    expect(pseudos(plan.targets)).toEqual(['Me', 'Alice', 'Bob'])
    expect(plan.skipped).toEqual([])
  })
})

describe('planBulk', () => {
  it('keeps the order of the selection and handles an empty one', () => {
    expect(pseudos(planBulk('grant', [bob, alice]).targets)).toEqual(['Bob', 'Alice'])
    expect(planBulk('disable', [])).toEqual({ targets: [], skipped: [] })
  })
})

describe('runBulk', () => {
  it('applies the task to each user, one at a time and in order', async () => {
    const order: string[] = []
    let running = 0
    let maxRunning = 0
    const result = await runBulk([alice, bob, me], async (target) => {
      running += 1
      maxRunning = Math.max(maxRunning, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      order.push(target.pseudo)
      running -= 1
    })
    expect(order).toEqual(['Alice', 'Bob', 'Me'])
    expect(maxRunning).toBe(1)
    expect(pseudos(result.done)).toEqual(['Alice', 'Bob', 'Me'])
    expect(result.failed).toEqual([])
  })

  it('lets the second call see the effect of the first (the last active administrator is judged in sequence)', async () => {
    let activeAdmins = 2
    const result = await runBulk([user('A1', { is_admin: true }), user('A2', { is_admin: true })], async () => {
      if (activeAdmins <= 1) throw new UserActionError('lastAdmin')
      activeAdmins -= 1
    })
    expect(pseudos(result.done)).toEqual(['A1'])
    expect(result.failed.map((item) => [item.user.pseudo, item.failure])).toEqual([['A2', 'lastAdmin']])
  })

  it('keeps going after a refusal and reports why', async () => {
    const result = await runBulk([alice, bob, me], async (target) => {
      if (target.pseudo === 'Alice') throw new UserActionError('self')
      if (target.pseudo === 'Bob') throw new Error('network down')
    })
    expect(pseudos(result.done)).toEqual(['Me'])
    expect(result.failed.map((item) => [item.user.pseudo, item.failure])).toEqual([['Alice', 'self'], ['Bob', 'failed']])
  })

  it('does nothing for an empty list', async () => {
    expect(await runBulk([], async () => { throw new Error('never called') })).toEqual({ done: [], failed: [] })
  })
})

describe('namesPreview', () => {
  it('lists everybody when there are few', () => {
    expect(namesPreview([alice, bob])).toEqual({ names: 'Alice, Bob', more: 0 })
  })

  it('names the first ones and counts the others', () => {
    const many = Array.from({ length: 9 }, (_, index) => user(`U${index}`))
    expect(namesPreview(many)).toEqual({ names: 'U0, U1, U2, U3, U4, U5', more: 3 })
    expect(namesPreview(many, 2)).toEqual({ names: 'U0, U1', more: 7 })
  })

  it('handles an empty list', () => {
    expect(namesPreview([])).toEqual({ names: '', more: 0 })
  })
})
