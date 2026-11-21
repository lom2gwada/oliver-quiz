import type { Language } from '../i18n/types'

const locale = (language: Language) => (language === 'en' ? 'en-GB' : 'fr-FR')

export const shortDate = (iso: string, language: Language) => new Date(iso).toLocaleDateString(locale(language), { day: 'numeric', month: 'short' })
/** Date et heure, pour le journal d'audit : « 21 nov. 2026, 14:05 ». */
export const dateTime = (iso: string, language: Language) => new Date(iso).toLocaleString(locale(language), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
export const longDate = (iso: string, language: Language) => new Date(iso).toLocaleDateString(locale(language), { day: 'numeric', month: 'short', year: 'numeric' })
