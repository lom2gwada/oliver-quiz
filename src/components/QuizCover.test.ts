import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { QuizCover } from './QuizCover'

const render = (image: Parameters<typeof QuizCover>[0]['image'], size?: 'small' | 'large') => renderToStaticMarkup(createElement(QuizCover, { image, size }))

describe('QuizCover', () => {
  it('renders nothing for a quiz without image, so no empty box is reserved', () => {
    expect(render(undefined)).toBe('')
  })

  it('renders the image with its alternative text in a fixed-size box', () => {
    const html = render({ url: 'https://x.org/a.png', alt: 'Couverture du livre' }, 'large')
    expect(html).toContain('src="https://x.org/a.png"')
    expect(html).toContain('alt="Couverture du livre"')
    expect(html).toContain('quiz-cover-large')
  })

  it('defaults to the small size', () => {
    expect(render({ url: 'https://x.org/a.png', alt: 'Couverture' })).toContain('quiz-cover-small')
  })
})
