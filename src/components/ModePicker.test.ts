import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', () => ({ useTranslation: () => ({ t: (key: string, ...args: unknown[]) => [key, ...args].join(':'), language: 'fr' }) }))

import { ModePicker, nextMode } from './ModePicker'

describe('nextMode', () => {
  it('moves with the arrow keys and wraps around', () => {
    expect(nextMode('classic', 'ArrowRight')).toBe('streak')
    expect(nextMode('timed', 'ArrowRight')).toBe('classic')
    expect(nextMode('classic', 'ArrowLeft')).toBe('timed')
    expect(nextMode('streak', 'ArrowDown')).toBe('timed')
    expect(nextMode('streak', 'ArrowUp')).toBe('classic')
  })

  it('jumps to the first and last mode with Home and End', () => {
    expect(nextMode('streak', 'Home')).toBe('classic')
    expect(nextMode('streak', 'End')).toBe('timed')
  })

  it('ignores every other key', () => {
    expect(nextMode('classic', 'a')).toBeNull()
    expect(nextMode('classic', 'Tab')).toBeNull()
    expect(nextMode('classic', 'Enter')).toBeNull()
  })
})

describe('ModePicker', () => {
  const html = renderToStaticMarkup(createElement(ModePicker, { value: 'streak', onChange: () => undefined }))

  it('is a radio group with one radio per mode, only the chosen one checked', () => {
    expect(html).toContain('role="radiogroup"')
    expect(html.match(/role="radio"/g)).toHaveLength(3)
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(html).toMatch(/aria-checked="true"[^>]*tabindex="0"[^>]*>common\.modeStreak/)
  })

  it('keeps a single tab stop: the other modes are reached with the arrow keys', () => {
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2)
  })

  it('explains the chosen mode right under the selector, and links the group to it', () => {
    expect(html).toContain('aria-describedby="mode-description"')
    expect(html).toContain('id="mode-description">start.modeDescription:streak')
  })
})
