import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const speechSupported = vi.hoisted(() => vi.fn(() => true))
vi.mock('@engine/utils/speech', () => ({ speechSupported, speakSentences: vi.fn(), stopSpeaking: vi.fn(), speechDiagnostics: () => '' }))
vi.mock('../i18n', () => ({ useTranslation: () => ({ t: (key: string) => key, language: 'fr' }) }))

import { CorrectionExplanation } from './CorrectionExplanation'

const render = (text: string) => renderToStaticMarkup(createElement(CorrectionExplanation, { text }))

describe('CorrectionExplanation', () => {
  beforeEach(() => speechSupported.mockReturnValue(true))

  it('shows the explanation with a button to listen to it', () => {
    const html = render('Le symbole W vient de Wolfram.')
    expect(html).toContain('<p>Le symbole W vient de Wolfram.</p>')
    expect(html).toContain('result.listenExplanation')
  })

  it('shows only the text when the browser cannot read aloud', () => {
    speechSupported.mockReturnValue(false)
    const html = render('Le symbole W vient de Wolfram.')
    expect(html).toContain('Le symbole W vient de Wolfram.')
    expect(html).not.toContain('<button')
  })

  it('has no button for an empty explanation', () => {
    expect(render('   ')).not.toContain('<button')
  })
})
