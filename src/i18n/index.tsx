import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { fr } from './fr'
import { en } from './en'
import type { Language } from './types'

export type { Language } from './types'
export type TranslationKey = keyof typeof fr

const translations = { fr, en }

/** Traduit une clé pour une langue donnée — utilisable directement là où `language` est déjà en scope
 * sans passer par le contexte (ex. `App.tsx`, qui porte l'état `language` et rend `LanguageProvider`,
 * donc ne peut pas consommer son propre contexte via `useTranslation()`). `useTranslation()` ci-dessous
 * n'est qu'un fin wrapper autour de cette même fonction pour les composants descendants.
 * Arguments non typés par clé (juste `unknown[]`) — un système de mapped types par signature serait de
 * la sur-ingénierie pour une appli de cette taille. Voir le plan i18n pour le contexte. */
export function translate(language: Language, key: TranslationKey, ...args: unknown[]): string {
  const entry = translations[language][key]
  return typeof entry === 'function' ? (entry as (...a: unknown[]) => string)(...args) : entry
}

const LanguageContext = createContext<Language>('fr')

export function LanguageProvider({ language, children }: { language: Language; children: ReactNode }) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>
}

export function useTranslation() {
  const language = useContext(LanguageContext)
  const t = (key: TranslationKey, ...args: unknown[]): string => translate(language, key, ...args)
  return { t, language }
}
