import { describe, expect, it, vi } from 'vitest'
import { runSaveJobs, type SaveJob } from './gameSave'

const noSleep = () => Promise.resolve()

describe('runSaveJobs', () => {
  it('returns nothing when every write succeeds, without any retry', async () => {
    const job = vi.fn().mockResolvedValue(undefined)
    expect(await runSaveJobs([job, job], { sleep: noSleep })).toEqual([])
    expect(job).toHaveBeenCalledTimes(2)
  })

  it('retries a failing write up to three attempts and recovers silently', async () => {
    const job = vi.fn().mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined)
    expect(await runSaveJobs([job], { sleep: noSleep })).toEqual([])
    expect(job).toHaveBeenCalledTimes(3)
  })

  it('waits longer before each new attempt (increasing delay)', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined)
    await runSaveJobs([vi.fn().mockRejectedValue(new Error('down'))], { sleep })
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([800, 2400])
  })

  it('gives up after three attempts and returns only the writes that still fail', async () => {
    const ok: SaveJob = vi.fn().mockResolvedValue(undefined)
    const broken: SaveJob = vi.fn().mockRejectedValue(new Error('rls'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failed = await runSaveJobs([ok, broken], { sleep: noSleep })
    expect(failed).toEqual([broken])
    expect(broken).toHaveBeenCalledTimes(3)
    expect(ok).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('lets a returned write be run again by the "Retry" button', async () => {
    const flaky = vi.fn().mockRejectedValueOnce(new Error('a')).mockRejectedValueOnce(new Error('b')).mockRejectedValueOnce(new Error('c')).mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failed = await runSaveJobs([flaky], { sleep: noSleep })
    expect(failed).toHaveLength(1)
    expect(await runSaveJobs(failed, { sleep: noSleep })).toEqual([])
    vi.restoreAllMocks()
  })

  it('renews the session before retrying when the token was rejected', async () => {
    const refreshSession = vi.fn().mockResolvedValue(undefined)
    const job = vi.fn().mockRejectedValueOnce({ code: 'PGRST301' }).mockResolvedValue(undefined)
    expect(await runSaveJobs([job], { sleep: noSleep, refreshSession })).toEqual([])
    expect(refreshSession).toHaveBeenCalledTimes(1)
  })

  it('does not touch the session for an ordinary failure', async () => {
    const refreshSession = vi.fn().mockResolvedValue(undefined)
    const job = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(undefined)
    await runSaveJobs([job], { sleep: noSleep, refreshSession })
    expect(refreshSession).not.toHaveBeenCalled()
  })
})
