import { describe, expect, it, vi } from 'vitest'
import { retryWithBackoff } from './retry'

const noSleep = () => Promise.resolve()

describe('retryWithBackoff', () => {
  it('returns the result without retrying when the first try succeeds', async () => {
    const task = vi.fn().mockResolvedValue('ok')
    await expect(retryWithBackoff(task, { delaysMs: [10, 20], sleep: noSleep })).resolves.toBe('ok')
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('retries after a failure and returns the first success', async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok')
    await expect(retryWithBackoff(task, { delaysMs: [10, 20], sleep: noSleep })).resolves.toBe('ok')
    expect(task).toHaveBeenCalledTimes(2)
  })

  it('gives up after the last delay and rethrows the last error', async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error('first')).mockRejectedValueOnce(new Error('second')).mockRejectedValue(new Error('last'))
    await expect(retryWithBackoff(task, { delaysMs: [10, 20], sleep: noSleep })).rejects.toThrow('last')
    expect(task).toHaveBeenCalledTimes(3)
  })

  it('waits the configured delay before each retry, in order', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    const task = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(retryWithBackoff(task, { delaysMs: [10, 20], sleep })).rejects.toThrow()
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([10, 20])
  })

  it('calls onRetry with the error before each retry only', async () => {
    const onRetry = vi.fn()
    const failure = new Error('boom')
    const task = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue('ok')
    await retryWithBackoff(task, { delaysMs: [10], onRetry, sleep: noSleep })
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(failure)
  })

  it('does not retry at all with no delays', async () => {
    const task = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(retryWithBackoff(task, { delaysMs: [] })).rejects.toThrow('boom')
    expect(task).toHaveBeenCalledTimes(1)
  })
})
