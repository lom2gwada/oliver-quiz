import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { rateColor } from './components/ThemeHeatmap'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

/** Contraste WCAG 2 entre deux couleurs (#rrggbb ou rgb()). */
function luminance([r, g, b]: number[]): number {
  const channel = (value: number) => { const v = value / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
const rgb = (hex: string): number[] => { const h = hex.trim().replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) }
const ratio = (a: number[], b: number[]) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }

/** Les variables d'un bloc de styles.css, ex. `:root {` ou `:root[data-theme="light"] {`. */
function variables(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const block = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((match) => [match[1], match[2]]))
}
const dark = variables(':root')
const light = { ...dark, ...variables(':root[data-theme="light"]') }

/** Convertit `hsl(h s% l%)` en rgb. */
function hslToRgb(value: string): number[] {
  const [h, s, l] = value.match(/[\d.]+/g)!.map(Number)
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))) }
  return [f(0), f(8), f(4)]
}

describe.each([['light', light], ['dark', dark]] as const)('%s theme contrast (WCAG AA)', (_name, theme) => {
  // Le fond de page est un dégradé : on prend sa couleur la plus défavorable, avec les surfaces qui portent du texte.
  const backgrounds = ['bg-grad-a', 'bg-grad-b', 'surface-solid', 'surface-alt', 'surface-selected'] as const

  it.each(['text', 'ink', 'text-soft', 'text-muted', 'accent-text', 'gold', 'success-text', 'info-text'])('text colour --%s reads at 4.5:1 on every surface', (name) => {
    const worst = Math.min(...backgrounds.map((bg) => ratio(rgb(theme[name]), rgb(theme[bg]))))
    expect(worst, `--${name} on its worst surface`).toBeGreaterThanOrEqual(4.5)
  })

  it('error text reads at 4.5:1 on the error background', () => {
    expect(ratio(rgb(theme['danger-text']), rgb(theme['danger-bg']))).toBeGreaterThanOrEqual(4.5)
  })

  it('the border of a field stands out at 3:1 from the field', () => {
    expect(ratio(rgb(theme['border-input']), rgb(theme['surface-solid']))).toBeGreaterThanOrEqual(3)
  })

  it('the large score figure reads at 3:1 from start to end of its gradient', () => {
    for (const name of ['score-from', 'score-to']) expect(ratio(rgb(theme[name]), rgb(theme['bg-grad-a']))).toBeGreaterThanOrEqual(3)
  })
})

describe('heatmap cells', () => {
  it('keep white text readable at 4.5:1 over the whole red-to-green range', () => {
    for (let rate = 0; rate <= 100; rate += 5) {
      expect(ratio([255, 255, 255], hslToRgb(rateColor(rate))), `${rate} %`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
