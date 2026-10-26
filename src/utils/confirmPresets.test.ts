import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { fr } from '../i18n/fr'
import { abandonGameConfirm, deleteAccountConfirm, deleteGuestLinkConfirm, deleteQuestionConfirm, leaveProfileConfirm } from './confirmPresets'

const translator = (messages: Record<string, unknown>) => (key: string, ...args: unknown[]) => {
  const entry = messages[key]
  return typeof entry === 'function' ? (entry as (...a: unknown[]) => string)(...args) : String(entry)
}

describe.each([['fr', fr], ['en', en]] as const)('confirmation presets (%s)', (_language, messages) => {
  const t = translator(messages as unknown as Record<string, unknown>) as Parameters<typeof abandonGameConfirm>[0]
  const presets = [
    abandonGameConfirm(t, 'Votre progression sera perdue.'),
    deleteQuestionConfirm(t),
    deleteGuestLinkConfirm(t),
    leaveProfileConfirm(t),
    deleteAccountConfirm(t),
  ]

  it('are all destructive, with a title, a message and an explicit action label (never « OK »)', () => {
    for (const preset of presets) {
      expect(preset.destructive).toBe(true)
      expect(preset.title).toBeTruthy()
      expect(preset.message).toBeTruthy()
      expect(preset.confirmLabel).toBeTruthy()
      expect(preset.confirmLabel).not.toMatch(/^(ok|oui|yes)$/i)
    }
  })

  it('translate every label (no key left as is)', () => {
    for (const preset of presets) {
      for (const text of [preset.title, preset.confirmLabel, preset.cancelLabel]) expect(text ?? '').not.toMatch(/^confirm\./)
    }
  })

  it('blur the page only when leaving a game', () => {
    expect(presets[0].blur).toBe(true)
    for (const preset of presets.slice(1)) expect(preset.blur).toBeFalsy()
  })
})

describe('French labels', () => {
  const t = translator(fr as unknown as Record<string, unknown>) as Parameters<typeof abandonGameConfirm>[0]

  it('name the action, as the ticket asks', () => {
    expect(abandonGameConfirm(t, 'x').confirmLabel).toBe('Abandonner la partie')
    expect(deleteQuestionConfirm(t).confirmLabel).toBe('Supprimer la question')
  })

  it('give the cancel button a label that says what staying means after clicking « Annuler » on a game', () => {
    expect(abandonGameConfirm(t, 'x').cancelLabel).toBe('Continuer la partie')
  })
})
