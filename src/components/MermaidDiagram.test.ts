// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fr } from '../i18n/fr'

vi.mock('../i18n', () => ({
  useTranslation: () => ({ t: (key: keyof typeof fr) => fr[key] as string, language: 'fr' }),
}))
vi.mock('../utils/mermaidRender', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/mermaidRender')>()),
  renderDiagram: vi.fn(),
}))

import { renderDiagram } from '../utils/mermaidRender'
import { MermaidDiagram } from './MermaidDiagram'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const render = renderDiagram as unknown as ReturnType<typeof vi.fn>
let container: HTMLDivElement
let root: Root

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })
const mount = async (chart = 'classDiagram\n A <|-- B') => { await act(async () => { root.render(createElement(MermaidDiagram, { chart })) }); await flush() }

beforeEach(() => {
  render.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks() })

describe('MermaidDiagram', () => {
  it('shows the drawn diagram', async () => {
    render.mockResolvedValue('<svg id="drawn"></svg>')
    await mount()
    expect(container.querySelector('.question-diagram svg#drawn')).not.toBeNull()
    expect(container.querySelector('.question-diagram-error')).toBeNull()
  })

  it('shows nothing while the diagram is being drawn', async () => {
    render.mockReturnValue(new Promise(() => {}))
    await mount()
    expect(container.innerHTML).toBe('')
  })

  it('says the diagram could not be displayed, gives the cause and offers to retry', async () => {
    render.mockRejectedValue(new TypeError('Failed to fetch dynamically imported module: x'))
    await mount()
    const note = container.querySelector('.question-diagram-error')
    expect(note?.getAttribute('role')).toBe('note')
    expect(note?.textContent).toContain('Le diagramme de cette question n’a pas pu être affiché.')
    expect(container.querySelector('.question-diagram-cause')?.textContent).toBe('Failed to fetch dynamically imported module: x')
    expect(note?.querySelector('button')?.textContent).toBe('Réessayer')
  })

  it('draws the diagram when « Réessayer » succeeds, with a fresh identifier', async () => {
    render.mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module')).mockResolvedValue('<svg id="drawn"></svg>')
    await mount()
    await act(async () => { container.querySelector<HTMLButtonElement>('.question-diagram-error button')!.click() })
    await flush()
    expect(container.querySelector('svg#drawn')).not.toBeNull()
    expect(container.querySelector('.question-diagram-error')).toBeNull()
    expect(render).toHaveBeenCalledTimes(2)
    const [firstId, secondId] = render.mock.calls.map((call) => call[0] as string)
    expect(firstId).toMatch(/^mermaid-/)
    expect(secondId).not.toBe(firstId)
  })

  it('keeps the message when the retry fails again', async () => {
    render.mockRejectedValue(new Error('Parse error on line 2:\n...'))
    await mount()
    await act(async () => { container.querySelector<HTMLButtonElement>('.question-diagram-error button')!.click() })
    await flush()
    expect(container.querySelector('.question-diagram-error')).not.toBeNull()
    expect(container.querySelector('.question-diagram-cause')?.textContent).toBe('Parse error on line 2:')
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('draws the new chart when the question changes', async () => {
    render.mockResolvedValueOnce('<svg id="first"></svg>').mockResolvedValueOnce('<svg id="second"></svg>')
    await mount('flowchart LR\n A --> B')
    await mount('flowchart LR\n B --> C')
    expect(container.querySelector('svg#second')).not.toBeNull()
    expect(container.querySelector('svg#first')).toBeNull()
  })

  it('ignores an answer that arrives after the component has gone', async () => {
    let resolve: (svg: string) => void = () => {}
    render.mockReturnValue(new Promise<string>((done) => { resolve = done }))
    await mount()
    act(() => root.unmount())
    await act(async () => { resolve('<svg></svg>') })
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('unmounted'))
    root = createRoot(container)
  })
})
