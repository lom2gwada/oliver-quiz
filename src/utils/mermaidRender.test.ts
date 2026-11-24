// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const initialize = vi.fn()
const render = vi.fn()
const parse = vi.fn()

/** Le module est rechargé à chaque test : `loadMermaid` garde l'import réussi dans une variable de module. */
async function load(mermaidFactory: () => Record<string, unknown> = () => ({ default: { initialize, render, parse } })) {
  vi.resetModules()
  vi.doMock('mermaid', mermaidFactory)
  return import('./mermaidRender')
}

beforeEach(() => {
  initialize.mockReset(); render.mockReset(); parse.mockReset()
  render.mockResolvedValue({ svg: '<svg>ok</svg>' })
  parse.mockResolvedValue(true)
  delete document.documentElement.dataset.theme
  document.body.innerHTML = ''
})
afterEach(() => { vi.doUnmock('mermaid') })

const loadFailure = () => new TypeError('Failed to fetch dynamically imported module: https://example.com/assets/sequenceDiagram-1.js')

describe('renderDiagram', () => {
  it('renders the chart and returns the svg, with the dark theme by default', async () => {
    const { renderDiagram } = await load()
    await expect(renderDiagram('m-1', 'classDiagram\n A <|-- B')).resolves.toBe('<svg>ok</svg>')
    expect(render).toHaveBeenCalledWith('m-1', 'classDiagram\n A <|-- B')
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ startOnLoad: false, suppressErrorRendering: true, theme: 'dark' }))
  })

  it('uses the light Mermaid theme when the app is in light mode', async () => {
    document.documentElement.dataset.theme = 'light'
    const { renderDiagram } = await load()
    await renderDiagram('m-1', 'flowchart LR\n A --> B')
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'default' }))
  })

  it('retries a failed download and succeeds on the next attempt', async () => {
    render.mockRejectedValueOnce(loadFailure())
    const { renderDiagram } = await load()
    await expect(renderDiagram('m-1', 'sequenceDiagram\n A->>B: x', () => true, [0, 0])).resolves.toBe('<svg>ok</svg>')
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('gives up after the last delay: first try plus one retry per delay', async () => {
    render.mockRejectedValue(loadFailure())
    const { renderDiagram } = await load()
    await expect(renderDiagram('m-1', 'sequenceDiagram\n A->>B: x', () => true, [0, 0])).rejects.toThrow('dynamically imported module')
    expect(render).toHaveBeenCalledTimes(3)
  })

  it('does not retry an invalid diagram: a syntax error fails straight away', async () => {
    render.mockRejectedValue(new Error('Parse error on line 2:\n... got INVALID'))
    const { renderDiagram } = await load()
    await expect(renderDiagram('m-1', 'classDiagram\n ???', () => true, [0, 0])).rejects.toThrow('Parse error')
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('stops retrying once the caller says the diagram is no longer wanted', async () => {
    render.mockRejectedValue(loadFailure())
    let wanted = true
    const { renderDiagram } = await load()
    const result = renderDiagram('m-1', 'sequenceDiagram\n A->>B: x', () => wanted, [5, 5])
    wanted = false
    await expect(result).rejects.toThrow()
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('removes the leftovers Mermaid drops in the page when a render fails', async () => {
    document.body.innerHTML = '<div id="dm-1"><svg></svg></div><svg id="m-1"></svg><p id="keep">x</p>'
    render.mockRejectedValue(new Error('Parse error'))
    const { renderDiagram } = await load()
    await expect(renderDiagram('m-1', 'classDiagram\n ???')).rejects.toThrow()
    expect(document.getElementById('dm-1')).toBeNull()
    expect(document.getElementById('m-1')).toBeNull()
    expect(document.getElementById('keep')).not.toBeNull()
  })

  it('does not keep a failed import: the next call downloads Mermaid again instead of replaying the failure', async () => {
    let calls = 0
    const { loadMermaid } = await load(() => {
      calls++
      if (calls === 1) throw loadFailure()
      return { default: { initialize, render, parse } }
    })
    await expect(loadMermaid()).rejects.toThrow()
    await expect(loadMermaid()).resolves.toEqual({ initialize, render, parse })
    expect(calls).toBe(2)
  })

  it('keeps a successful import: Mermaid is loaded once for several diagrams', async () => {
    let calls = 0
    const { renderDiagram } = await load(() => { calls++; return { default: { initialize, render, parse } } })
    await renderDiagram('m-1', 'flowchart LR\n A --> B')
    await renderDiagram('m-2', 'flowchart LR\n B --> C')
    expect(calls).toBe(1)
  })
})

describe('isLoadFailure', () => {
  it('recognises the download errors of the main browsers', async () => {
    const { isLoadFailure } = await load()
    expect(isLoadFailure(new TypeError('Failed to fetch dynamically imported module: x'))).toBe(true)
    expect(isLoadFailure(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isLoadFailure(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isLoadFailure(new Error('Loading chunk 12 failed.'))).toBe(true)
  })

  it('does not take a syntax error or an unknown value for a download problem', async () => {
    const { isLoadFailure } = await load()
    expect(isLoadFailure(new Error('Parse error on line 3'))).toBe(false)
    expect(isLoadFailure(new Error('No diagram type detected matching given configuration for text: ???'))).toBe(false)
    expect(isLoadFailure('boom')).toBe(false)
  })
})

describe('describeError', () => {
  it('keeps the first non-empty line only', async () => {
    const { describeError } = await load()
    expect(describeError(new Error('\n  Parse error on line 2:\n...gibberish\n^'))).toBe('Parse error on line 2:')
  })

  it('shortens a very long message and accepts non-Error values', async () => {
    const { describeError } = await load()
    expect(describeError(new Error('x'.repeat(300)))).toHaveLength(138)
    expect(describeError('texte brut')).toBe('texte brut')
  })
})

describe('diagramKind', () => {
  it('reads the diagram type on the first line', async () => {
    const { diagramKind } = await load()
    expect(diagramKind('classDiagram\n  A <|-- B')).toBe('classDiagram')
    expect(diagramKind('flowchart LR\n  A --> B')).toBe('flowchart')
    expect(diagramKind('  stateDiagram-v2\n  [*] --> A')).toBe('stateDiagram-v2')
  })

  it('skips a front matter block and comments', async () => {
    const { diagramKind } = await load()
    expect(diagramKind('---\ntitle: Mon schéma\n---\nsequenceDiagram\n A->>B: x')).toBe('sequenceDiagram')
    expect(diagramKind('%% commentaire\ngitGraph\n commit')).toBe('gitGraph')
  })
})

describe('preloadDiagrams', () => {
  it('downloads nothing when no question has a diagram', async () => {
    let imported = false
    const { preloadDiagrams } = await load(() => { imported = true; return { default: { initialize, render, parse } } })
    await preloadDiagrams([{ diagram: undefined }, {}])
    expect(imported).toBe(false)
    expect(parse).not.toHaveBeenCalled()
  })

  it('warms up each diagram type once, whatever the number of questions', async () => {
    const { preloadDiagrams } = await load()
    await preloadDiagrams([
      { diagram: 'classDiagram\n A <|-- B' }, { diagram: 'sequenceDiagram\n A->>B: x' }, { diagram: 'classDiagram\n C <|-- D' }, {},
    ])
    expect(parse).toHaveBeenCalledTimes(2)
    expect(parse).toHaveBeenCalledWith('classDiagram\n A <|-- B', { suppressErrors: true })
    expect(parse).toHaveBeenCalledWith('sequenceDiagram\n A->>B: x', { suppressErrors: true })
  })

  it('never throws, even when the download or the parse fails', async () => {
    parse.mockRejectedValue(new Error('boom'))
    const { preloadDiagrams } = await load()
    await expect(preloadDiagrams([{ diagram: 'classDiagram\n A <|-- B' }])).resolves.toBeUndefined()
    const failing = await load(() => { throw loadFailure() })
    await expect(failing.preloadDiagrams([{ diagram: 'classDiagram\n A <|-- B' }])).resolves.toBeUndefined()
  })
})
