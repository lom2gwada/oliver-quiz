// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONFIRMING_CLASS, confirmWithBlur } from './confirmWithBlur'

describe('confirmWithBlur', () => {
  let root: HTMLElement

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    root = document.getElementById('root') as HTMLElement
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0))
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('blurs the page while the dialog is open and removes the blur afterwards', async () => {
    let blurredWhenAsked: boolean | null = null
    vi.spyOn(window, 'confirm').mockImplementation(() => { blurredWhenAsked = root.classList.contains(CONFIRMING_CLASS); return true })
    const answer = await confirmWithBlur('Abandonner ?')
    expect(blurredWhenAsked).toBe(true)
    expect(answer).toBe(true)
    expect(root.classList.contains(CONFIRMING_CLASS)).toBe(false)
  })

  it('passes the message through and returns the user choice', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    expect(await confirmWithBlur('Supprimer ?')).toBe(false)
    expect(confirmSpy).toHaveBeenCalledWith('Supprimer ?')
  })

  it('opens only one dialog for a double click, the second call being refused', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const [first, second] = await Promise.all([confirmWithBlur('Abandonner ?'), confirmWithBlur('Abandonner ?')])
    expect([first, second]).toEqual([true, false])
    expect(confirmSpy).toHaveBeenCalledTimes(1)
  })

  it('removes the blur even if the dialog throws, and accepts a new confirmation afterwards', async () => {
    vi.spyOn(window, 'confirm').mockImplementationOnce(() => { throw new Error('boom') })
    await expect(confirmWithBlur('x')).rejects.toThrow('boom')
    expect(root.classList.contains(CONFIRMING_CLASS)).toBe(false)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    expect(await confirmWithBlur('y')).toBe(true)
  })
})
