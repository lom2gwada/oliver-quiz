import { afterEach, describe, expect, it, vi } from 'vitest'
import { confirmDialog, getPendingConfirm, settleConfirm, subscribeConfirm } from './confirmDialog'

const options = { message: 'Abandonner ?', confirmLabel: 'Abandonner la partie', destructive: true }

afterEach(() => settleConfirm(false))

describe('confirmDialog', () => {
  it('waits for the answer, exposing the question to the dialog', async () => {
    const answer = confirmDialog(options)
    expect(getPendingConfirm()?.options).toEqual(options)
    settleConfirm(true)
    await expect(answer).resolves.toBe(true)
    expect(getPendingConfirm()).toBeNull()
  })

  it('answers false when the dialog is cancelled', async () => {
    const answer = confirmDialog(options)
    settleConfirm(false)
    await expect(answer).resolves.toBe(false)
  })

  it('refuses a second confirmation while one is open, so a double click opens a single dialog', async () => {
    const first = confirmDialog(options)
    await expect(confirmDialog(options)).resolves.toBe(false)
    expect(getPendingConfirm()).not.toBeNull()
    settleConfirm(true)
    await expect(first).resolves.toBe(true)
  })

  it('accepts a new confirmation once the previous one is settled', async () => {
    const first = confirmDialog(options)
    settleConfirm(false)
    await first
    const second = confirmDialog(options)
    settleConfirm(true)
    await expect(second).resolves.toBe(true)
  })

  it('notifies subscribers when a confirmation opens and closes, and stops after unsubscribing', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeConfirm(listener)
    const answer = confirmDialog(options)
    settleConfirm(true)
    await answer
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    const later = confirmDialog(options)
    settleConfirm(true)
    await later
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('ignores a settle with nothing pending', () => {
    expect(() => settleConfirm(true)).not.toThrow()
  })
})
