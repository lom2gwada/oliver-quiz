export type Theme = 'dark' | 'light'

export interface Profile {
  pseudo: string
  avatar: string
  theme: Theme
  /** Lu depuis la base, jamais envoyé par le formulaire de profil — ne peut pas être auto-attribué via l'app. */
  isAdmin?: boolean
}
