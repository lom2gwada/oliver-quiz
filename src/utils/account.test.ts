import { describe, expect, it } from 'vitest'
import { classifyDeleteError } from './account'

describe('classifyDeleteError', () => {
  it('recognises the refusal made for the last administrator', () => {
    expect(classifyDeleteError('last_admin')).toBe('lastAdmin')
    expect(classifyDeleteError('P0001: last_admin')).toBe('lastAdmin')
  })

  it('reports any other failure as a generic one', () => {
    expect(classifyDeleteError('permission denied for table users')).toBe('failed')
    expect(classifyDeleteError('')).toBe('failed')
    expect(classifyDeleteError(undefined)).toBe('failed')
  })
})
