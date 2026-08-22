import { describe, expect, it } from 'vitest'
import { hasAuthLinkError, needsPasswordSetup } from './authLink'

describe('needsPasswordSetup', () => {
  it('detects an invite link', () => {
    expect(needsPasswordSetup('#access_token=abc&type=invite')).toBe(true)
  })

  it('detects a recovery link', () => {
    expect(needsPasswordSetup('#access_token=abc&type=recovery')).toBe(true)
  })

  it('ignores a normal session hash', () => {
    expect(needsPasswordSetup('#access_token=abc&type=signup')).toBe(false)
  })

  it('ignores an empty hash', () => {
    expect(needsPasswordSetup('')).toBe(false)
  })
})

describe('hasAuthLinkError', () => {
  it('detects the Supabase expired-link error hash', () => {
    expect(hasAuthLinkError('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')).toBe(true)
  })

  it('ignores a successful invite hash', () => {
    expect(hasAuthLinkError('#access_token=abc&type=invite')).toBe(false)
  })

  it('ignores an empty hash', () => {
    expect(hasAuthLinkError('')).toBe(false)
  })
})
