import type { TranslationKey } from '../i18n'
import type { Language } from '../i18n/types'
import { userStatus, type AdminUser } from './adminUsers'
import { localDay } from './dateFormat'

type Cell = string | number

/** Une cellule CSV. Entre guillemets si elle contient le séparateur, un guillemet, un saut de ligne ou des espaces en bordure.
 * Une valeur texte qui commencerait par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot serait EXÉCUTÉE comme une formule par un
 * tableur (injection CSV) : elle est précédée d'une apostrophe, que le tableur n'affiche pas. Les nombres, eux, ne sont jamais préfixés. */
export function csvCell(value: Cell, separator: string): string {
  if (typeof value === 'number') return String(value)
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return text.includes(separator) || /["\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text
}

/** Le séparateur qu'attend le tableur de la langue : le point-virgule en français (la virgule y sert aux décimales), la virgule en anglais. */
export const csvSeparator = (language: Language): string => (language === 'fr' ? ';' : ',')

/** Une date au format `AAAA-MM-JJ` (triable, sans ambiguïté de langue), vide si elle n'existe pas. */
export const isoDay = (iso: string | null): string => (iso ? iso.slice(0, 10) : '')

type Translate = (key: TranslationKey, ...args: unknown[]) => string

/** La liste des utilisateurs en CSV, dans l'ordre donné : pseudo, email, rôle, statut, dates et parties. UTF-8 avec BOM (sans lui Excel
 * lit mal les accents), lignes séparées par CRLF. Contient des adresses email : des données personnelles. */
export function usersToCsv(users: AdminUser[], t: Translate, language: Language): string {
  const separator = csvSeparator(language)
  const header = [t('usersCsv.colPseudo'), t('usersCsv.colEmail'), t('usersCsv.colRole'), t('usersCsv.colStatus'), t('usersCsv.colJoined'), t('usersCsv.colLastSignIn'), t('usersCsv.colGames'), t('usersCsv.colLastPlayed')]
  const status = { active: t('userDetail.statusActive'), disabled: t('userDetail.statusDisabled'), never: t('userDetail.statusNever') }
  const rows = users.map((user): Cell[] => [
    user.pseudo, user.email ?? '', user.is_admin ? t('userDetail.roleAdmin') : t('userDetail.rolePlayer'), status[userStatus(user)],
    isoDay(user.created_at), isoDay(user.last_sign_in_at), user.games_played, isoDay(user.last_played_at),
  ])
  return '\uFEFF' + [header, ...rows].map((row) => row.map((cell) => csvCell(cell, separator)).join(separator)).join('\r\n') + '\r\n'
}

/** `utilisateurs-oliver-quiz-2026-11-24.csv`, avec le jour local de l'utilisateur. */
export const csvFilename = (date: Date): string => `utilisateurs-oliver-quiz-${localDay(date)}.csv`
