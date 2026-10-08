import { describe, expect, it } from 'vitest'
import { shuffle, shuffleAwayFrom } from './shuffle'

describe('shuffle', () => {
  it('keeps the same elements', () => {
    const items = [1, 2, 3, 4, 5]
    expect(shuffle(items).sort()).toEqual(items.sort())
  })

  it('does not mutate the original array', () => {
    const items = [1, 2, 3, 4, 5]
    const copy = [...items]
    shuffle(items)
    expect(items).toEqual(copy)
  })

  it('returns an empty array unchanged', () => {
    expect(shuffle([])).toEqual([])
  })

  it('returns a single-item array unchanged', () => {
    expect(shuffle(['a'])).toEqual(['a'])
  })

  it('preserves array length', () => {
    const items = Array.from({ length: 20 }, (_, index) => index)
    expect(shuffle(items)).toHaveLength(20)
  })
})

describe('shuffleAwayFrom', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('never returns the forbidden order', () => {
    for (let run = 0; run < 200; run += 1) {
      expect(shuffleAwayFrom(items, ['a', 'b', 'c']).map((item) => item.id)).not.toEqual(['a', 'b', 'c'])
    }
  })

  it('always leaves the only other order for two items', () => {
    for (let run = 0; run < 50; run += 1) {
      expect(shuffleAwayFrom([{ id: 'a' }, { id: 'b' }], ['a', 'b']).map((item) => item.id)).toEqual(['b', 'a'])
    }
  })

  it('keeps the same elements and does not mutate the input', () => {
    const copy = [...items]
    const result = shuffleAwayFrom(items, ['a', 'b', 'c'])
    expect(result.map((item) => item.id).sort()).toEqual(['a', 'b', 'c'])
    expect(items).toEqual(copy)
  })

  it('returns a single item unchanged', () => {
    expect(shuffleAwayFrom([{ id: 'a' }], ['a'])).toEqual([{ id: 'a' }])
  })
})
