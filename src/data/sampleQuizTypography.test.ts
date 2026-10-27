import { describe, expect, it } from 'vitest'
import sampleQuiz from './sample-quiz.json'

/** Tous les textes du quiz d'exemple (énoncés, réponses, explications, libellés…), hors identifiants et adresses. */
function texts(): { path: string; text: string }[] {
  const found: { path: string; text: string }[] = []
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') {
      if (!/(^|\.)(id|type|theme|difficulty|imageUrl|createdAt)$/.test(path) && !/\.tags\.\d+$/.test(path) && !/\.correctPairs\./.test(path)) found.push({ path, text: value })
    } else if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}.${index}`))
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => walk(item, path ? `${path}.${key}` : key))
  }
  walk(sampleQuiz, '')
  return found
}

describe('sample quiz typography (French)', () => {
  const all = texts()

  it('reads every text of the quiz', () => {
    expect(all.length).toBeGreaterThan(300)
  })

  it('uses « guillemets » instead of straight double quotes', () => {
    expect(all.filter(({ text }) => text.includes('"')).map(({ path }) => path)).toEqual([])
  })

  it('puts a no-break space, not a plain space, before ? ! : ; and %', () => {
    expect(all.filter(({ text }) => / [?!:;%]/.test(text)).map(({ path }) => path)).toEqual([])
  })

  it('writes a percentage as « 78 % », never « 78% »', () => {
    expect(all.filter(({ text }) => /\d%/.test(text)).map(({ path }) => path)).toEqual([])
  })

  it('keeps a no-break space between a number and its unit, and inside large numbers', () => {
    expect(all.filter(({ text }) => /\d (km|m|mètres|os|°C|km\/s|m\/s)\b/.test(text)).map(({ path }) => path)).toEqual([])
    expect(all.filter(({ text }) => /\d \d{3}\b/.test(text)).map(({ path }) => path)).toEqual([])
  })

  it('wraps a guillemet with no-break spaces inside', () => {
    expect(all.filter(({ text }) => /«(?! )|(?<! )»/.test(text)).map(({ path }) => path)).toEqual([])
  })

  it('has the corrections quoted in the ticket', () => {
    const joined = all.map(({ text }) => text).join('\n')
    expect(joined).toContain('Combien de joueurs composent une équipe')
    expect(joined).not.toContain('joueurs compose ')
    expect(joined).toContain('78 %')
    expect(joined).toContain('N₂')
    expect(joined).toContain('H₂O')
    expect(joined).not.toMatch(/\bN2\b|\bH2O\b/)
  })
})
