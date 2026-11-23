import { describe, expect, it } from 'vitest'
import { fr } from '../i18n/fr'
import { en } from '../i18n/en'
import type { AdminUser } from './adminUsers'
import { csvCell, csvFilename, csvSeparator, isoDay, usersToCsv } from './adminUsersCsv'

const translate = (dictionary: Record<string, unknown>) => (key: string, ...args: unknown[]) => {
  const value = dictionary[key]
  return typeof value === 'function' ? (value as (...a: unknown[]) => string)(...args) : String(value)
}
const tFr = translate(fr as Record<string, unknown>) as Parameters<typeof usersToCsv>[1]
const tEn = translate(en as Record<string, unknown>) as Parameters<typeof usersToCsv>[1]

const user = (pseudo: string, overrides: Partial<AdminUser> = {}): AdminUser => ({
  user_id: `id-${pseudo}`, pseudo, avatar: '🙂', email: `${pseudo.toLowerCase()}@example.com`, is_admin: false, is_self: false,
  created_at: '2026-08-26T10:00:00Z', last_sign_in_at: '2026-10-26T10:00:00Z', disabled: false, games_played: 12, last_played_at: '2026-10-25T08:00:00Z',
  ...overrides,
})

describe('csvCell', () => {
  it('leaves a plain value alone', () => {
    expect(csvCell('Alice', ';')).toBe('Alice')
    expect(csvCell('alice@example.com', ',')).toBe('alice@example.com')
  })

  it('quotes a value that contains the separator, a quote or a line break, doubling the quotes', () => {
    expect(csvCell('a;b', ';')).toBe('"a;b"')
    expect(csvCell('a,b', ',')).toBe('"a,b"')
    expect(csvCell('say "hi"', ';')).toBe('"say ""hi"""')
    expect(csvCell('one\ntwo', ';')).toBe('"one\ntwo"')
    expect(csvCell('one\r\ntwo', ';')).toBe('"one\r\ntwo"')
  })

  it('does not quote a comma when the separator is a semicolon', () => {
    expect(csvCell('a,b', ';')).toBe('a,b')
  })

  it('quotes a value with spaces around it, so that they survive', () => {
    expect(csvCell(' Alice ', ';')).toBe('" Alice "')
  })

  it.each(['=1+1', '+33612345678', '-2+3', '@SUM(A1)', '\t=cmd', '\r=cmd'])('defuses a value that a spreadsheet would run as a formula: %j', (value) => {
    const cell = csvCell(value, ';')
    expect(cell.replace(/^"/, '')[0]).toBe("'")
  })

  it('defuses a formula even when it also needs quoting', () => {
    expect(csvCell('=HYPERLINK("http://x";"y")', ';')).toBe('"\'=HYPERLINK(""http://x"";""y"")"')
  })

  it('never prefixes a number, even a negative one', () => {
    expect(csvCell(-5, ';')).toBe('-5')
    expect(csvCell(12, ';')).toBe('12')
    expect(csvCell(0, ';')).toBe('0')
  })

  it('leaves an email with a plus in the middle alone, and only touches one that STARTS with an operator', () => {
    expect(csvCell('alice+quiz@example.com', ';')).toBe('alice+quiz@example.com')
  })
})

describe('csvSeparator', () => {
  it('is a semicolon in French (the comma is the decimal mark) and a comma in English', () => {
    expect(csvSeparator('fr')).toBe(';')
    expect(csvSeparator('en')).toBe(',')
  })
})

describe('isoDay', () => {
  it('keeps the date and is empty when there is none', () => {
    expect(isoDay('2026-10-26T10:00:00Z')).toBe('2026-10-26')
    expect(isoDay(null)).toBe('')
  })
})

describe('usersToCsv', () => {
  const users = [
    user('Alice', { is_admin: true }),
    user('Bob', { last_sign_in_at: null, last_played_at: null, games_played: 0 }),
    user('Carl', { disabled: true }),
  ]

  it('starts with a byte order mark so that Excel reads the accents, and ends with a line break', () => {
    const csv = usersToCsv(users, tFr, 'fr')
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('has a header, then one line per user in the order given, separated by CRLF', () => {
    const lines = usersToCsv(users, tFr, 'fr').slice(1).split('\r\n')
    expect(lines[0]).toBe('Pseudo;Email;Rôle;Statut;Inscrit le;Dernière connexion;Parties;Dernière partie')
    expect(lines.slice(1, 4).map((line) => line.split(';')[0])).toEqual(['Alice', 'Bob', 'Carl'])
    expect(lines[4]).toBe('')
  })

  it('writes role, status, ISO dates and the number of games', () => {
    const lines = usersToCsv(users, tFr, 'fr').slice(1).split('\r\n')
    expect(lines[1]).toBe('Alice;alice@example.com;Administrateur;Actif;2026-08-26;2026-10-26;12;2026-10-25')
    expect(lines[2]).toBe('Bob;bob@example.com;Joueur;Jamais connecté;2026-08-26;;0;')
    expect(lines[3]).toBe('Carl;carl@example.com;Joueur;Désactivé;2026-08-26;2026-10-26;12;2026-10-25')
  })

  it('is written in English with commas', () => {
    const lines = usersToCsv(users, tEn, 'en').slice(1).split('\r\n')
    expect(lines[0]).toBe('Nickname,Email,Role,Status,Registered,Last sign-in,Games,Last game')
    expect(lines[1]).toBe('Alice,alice@example.com,Administrator,Active,2026-08-26,2026-10-26,12,2026-10-25')
  })

  it('defuses a nickname or an email that a spreadsheet would run as a formula', () => {
    const csv = usersToCsv([user('=cmd|calc', { email: '@evil.example' })], tFr, 'fr')
    expect(csv).toContain("'=cmd|calc;'@evil.example;")
    expect(csv).not.toMatch(/(^|[;\n])=cmd/)
  })

  it('quotes a nickname that contains the separator', () => {
    expect(usersToCsv([user('A;B')], tFr, 'fr')).toContain('"A;B";"a;b@example.com"')
  })

  it('handles a user without email and an empty list', () => {
    expect(usersToCsv([user('Dana', { email: null })], tFr, 'fr')).toContain('Dana;;Joueur')
    expect(usersToCsv([], tFr, 'fr').slice(1).split('\r\n').filter(Boolean)).toHaveLength(1)
  })

  it('gives every row the same number of columns as the header', () => {
    const lines = usersToCsv(users, tFr, 'fr').slice(1).split('\r\n').filter(Boolean)
    for (const line of lines) expect(line.split(';')).toHaveLength(8)
  })
})

describe('csvFilename', () => {
  it('carries the date of the day', () => {
    expect(csvFilename(new Date(2026, 10, 24, 23, 30))).toBe('utilisateurs-oliver-quiz-2026-11-24.csv')
  })

  it('uses the local day, not the UTC day: a file exported just after midnight carries today’s date', () => {
    expect(csvFilename(new Date(2026, 10, 24, 0, 5))).toBe('utilisateurs-oliver-quiz-2026-11-24.csv')
    expect(csvFilename(new Date(2026, 0, 5, 0, 0, 1))).toBe('utilisateurs-oliver-quiz-2026-01-05.csv')
  })
})
