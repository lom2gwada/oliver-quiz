import type { Language } from '../i18n/types'

export type Theme = 'dark' | 'light'

export interface Profile {
  pseudo: string
  avatar: string
  theme: Theme
  language: Language
  /** Lu depuis la base, jamais envoyé par le formulaire de profil — ne peut pas être auto-attribué via l'app. */
  isAdmin?: boolean
  /** Autorisé par l'administrateur global à créer des quiz (`profiles.can_create_quizzes`, 052). Lu depuis la base, jamais envoyé par le formulaire de profil. */
  canCreateQuizzes?: boolean
}
