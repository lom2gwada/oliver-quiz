import type { Language } from '../i18n/types'

const locale = (language: Language) => (language === 'en' ? 'en-GB' : 'fr-FR')

export const shortDate = (iso: string, language: Language) => new Date(iso).toLocaleDateString(locale(language), { day: 'numeric', month: 'short' })
export const longDate = (iso: string, language: Language) => new Date(iso).toLocaleDateString(locale(language), { day: 'numeric', month: 'short', year: 'numeric' })
