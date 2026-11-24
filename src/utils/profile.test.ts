import { beforeEach, describe, expect, it, vi } from 'vitest'

const upsert = vi.hoisted(() => vi.fn(async () => ({ error: null as { message: string } | null })))
vi.mock('./supabase', () => ({ supabase: { from: () => ({ upsert }) } }))

import { saveProfile } from './profile'

/** Les seules colonnes de `profiles` qu'un joueur a le droit d'écrire (migration 046_profiles_column_privileges.sql) : si
 * `saveProfile` en envoyait une autre, la base la refuserait et le profil ne s'enregistrerait plus. */
const WRITABLE_COLUMNS = ['avatar', 'language', 'pseudo', 'theme']

describe('saveProfile', () => {
  beforeEach(() => upsert.mockClear())

  it("n'envoie que les colonnes que la base autorise un joueur à écrire", async () => {
    await saveProfile({ pseudo: 'Alice', avatar: '🦊', theme: 'dark', language: 'fr' })
    const [payload, options] = upsert.mock.calls[0] as unknown as [Record<string, unknown>, { onConflict: string }]
    expect(Object.keys(payload).sort()).toEqual(WRITABLE_COLUMNS)
    expect(options).toEqual({ onConflict: 'id' })
  })

  it("n'envoie jamais le statut administrateur ni l'autorisation de créer des quiz, même si le profil les porte", async () => {
    await saveProfile({ pseudo: 'Alice', avatar: '🦊', theme: 'dark', language: 'fr', isAdmin: true, canCreateQuizzes: true })
    const [payload] = upsert.mock.calls[0] as unknown as [Record<string, unknown>]
    expect(payload).not.toHaveProperty('canCreateQuizzes')
    expect(payload).not.toHaveProperty('can_create_quizzes')
    expect(payload).not.toHaveProperty('isAdmin')
    expect(payload).not.toHaveProperty('is_admin')
    expect(Object.keys(payload).every((column) => WRITABLE_COLUMNS.includes(column))).toBe(true)
  })

  it("remonte l'erreur de la base", async () => {
    upsert.mockResolvedValueOnce({ error: { message: 'permission denied' } })
    await expect(saveProfile({ pseudo: 'Alice', avatar: '🦊', theme: 'dark', language: 'fr' })).rejects.toEqual({ message: 'permission denied' })
  })
})
