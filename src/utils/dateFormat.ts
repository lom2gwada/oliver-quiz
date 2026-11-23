import type { Language } from '../i18n/types'

const locale = (language: Language) => (language === 'en' ? 'en-GB' : 'fr-FR')

export const shortDate = (iso: string, language: Language) => new Date(iso).toLocaleDateString(locale(language), { day: 'numeric', month: 'short' })
/** Le jour de `date` dans le fuseau de l'utilisateur, au format `AAAA-MM-JJ` : pour nommer un fichier. `toISOString()` donnerait le jour UTC,
 * et un fichier exporté peu après minuit porterait la date de la veille. */
export const localDay = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** Date et heure, pour le journal d'audit : « 21 nov. 2026, 14:05 ». */
export const dateTime = (iso: string, language: Language) => new Date(iso).toLocaleString(locale(language), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export const longDate = (iso: string, language: Language) => new Date(iso).toLocaleDateString(locale(language), { day: 'numeric', month: 'short', year: 'numeric' })
