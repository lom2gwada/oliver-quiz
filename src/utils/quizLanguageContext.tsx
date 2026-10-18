import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

/** Langue du contenu du quiz affiché (`metadata.language`), disponible pour les composants de question sans
 * la faire descendre en prop à travers tout l'arbre. `undefined` = quiz sans langue précisée. */
const QuizLanguageContext = createContext<string | undefined>(undefined)

export function QuizLanguageProvider({ language, children }: { language: string | undefined; children: ReactNode }) {
  return <QuizLanguageContext.Provider value={language}>{children}</QuizLanguageContext.Provider>
}

export const useQuizLanguage = (): string | undefined => useContext(QuizLanguageContext)
