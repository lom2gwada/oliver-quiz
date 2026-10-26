import type { Language } from '../i18n/types'

/** Régionalisation des nombres affichés : la virgule décimale et l'espace avant « % » en français (« 93,7 % »), le point
 * en anglais (« 93.7% »). Les locales sont celles déjà utilisées pour les dates et pour la dictée. */
const LOCALES: Record<Language, string> = { fr: 'fr-FR', en: 'en-GB' }

/** `maxFractionDigits` décimales au plus : « 8,2 », et « 8 » plutôt que « 8,0 ». */
export function formatNumber(value: number, language: Language, maxFractionDigits = 1): string {
  return new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: maxFractionDigits }).format(value)
}

/** `percent` est un pourcentage (93,7 pour 93,7 %), pas une fraction. */
export function formatPercent(percent: number, language: Language, maxFractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALES[language], { style: 'percent', maximumFractionDigits: maxFractionDigits }).format(percent / 100)
}
