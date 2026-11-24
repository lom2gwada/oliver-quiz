// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./mermaidRender', () => ({ preloadDiagrams: vi.fn(async () => {}) }))

import { preloadDiagrams } from './mermaidRender'
import { useDiagramPreload } from './useDiagramPreload'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const preload = preloadDiagrams as unknown as ReturnType<typeof vi.fn>

function Probe({ questions }: { questions: { diagram?: string }[] }) {
  useDiagramPreload(questions)
  return null
}

beforeEach(() => preload.mockClear())

describe('useDiagramPreload', () => {
  it('preloads the diagrams of the game’s questions once, when the page opens', async () => {
    const questions = [{ diagram: 'classDiagram\n A <|-- B' }, {}]
    const root = createRoot(document.createElement('div'))
    await act(async () => { root.render(createElement(Probe, { questions })) })
    await act(async () => { root.render(createElement(Probe, { questions })) })
    expect(preload).toHaveBeenCalledTimes(1)
    expect(preload).toHaveBeenCalledWith(questions)
    act(() => root.unmount())
  })

  it('preloads again when the list of questions changes', async () => {
    const root = createRoot(document.createElement('div'))
    await act(async () => { root.render(createElement(Probe, { questions: [{ diagram: 'flowchart LR\n A --> B' }] })) })
    await act(async () => { root.render(createElement(Probe, { questions: [{ diagram: 'gitGraph\n commit' }] })) })
    expect(preload).toHaveBeenCalledTimes(2)
    act(() => root.unmount())
  })
})
